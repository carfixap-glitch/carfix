import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

function serverKey() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      if (parsed?.default) return parsed.default as string;
    } catch {
      // Fall back to the legacy service-role key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function safeError(status: number, code: string, message: string, retryable = false) {
  return reply({ error: { code, message, retryable } }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return safeError(405, "method_not_allowed", "Use POST for payment orders.");

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return safeError(401, "unauthorized", "Please sign in to continue.");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return safeError(401, "unauthorized", "Your session has expired. Please sign in again.");

    let assessmentId = "";
    try {
      const body = await req.json();
      assessmentId = typeof body?.assessment_id === "string" ? body.assessment_id : "";
    } catch {
      return safeError(400, "invalid_request", "The payment request is not valid.");
    }
    if (!assessmentId) return safeError(400, "assessment_required", "An assessment is required for payment.");

    const key = serverKey();
    if (!key) return safeError(500, "server_configuration", "Payment service is temporarily unavailable.", true);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, key);

    const rateLimit = await checkRateLimit(db, user.id, "create_payment_order", 10, 600);
    if (!rateLimit.allowed) {
      return safeError(429, "rate_limit_exceeded", `Too many payment attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`, true);
    }

    const { data: assessment, error: assessmentError } = await db
      .from("assessments")
      .select("id,payment_required,payment_status,payment_amount")
      .eq("id", assessmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (assessmentError) return safeError(500, "assessment_lookup_failed", "Could not check this assessment.", true);
    if (!assessment) return safeError(404, "assessment_not_found", "Assessment not found.");
    if (!assessment.payment_required || assessment.payment_status === "free") {
      return reply({ success: true, payment_required: false, payment_status: "free" });
    }
    if (assessment.payment_status === "paid") {
      return reply({ success: true, payment_required: false, payment_status: "paid" });
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpaySecret) {
      return safeError(500, "server_configuration", "Payment service is temporarily unavailable.", true);
    }

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await db.from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("assessment_id", assessmentId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lt("created_at", staleBefore);

    const { data: existing } = await db.from("payments")
      .select("id,order_id,amount,currency")
      .eq("assessment_id", assessmentId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.order_id) {
      return reply({
        success: true,
        key_id: razorpayKeyId,
        order_id: existing.order_id,
        amount: Math.round(Number(existing.amount) * 100),
        currency: existing.currency,
      });
    }
    if (existing) return safeError(409, "order_in_progress", "A payment order is already being prepared. Please retry shortly.", true);

    const receipt = ("carfix_" + assessmentId.replaceAll("-", "")).slice(0, 40);
    const amountRupees = Number(assessment.payment_amount || 199);
    const { data: reservation, error: reserveError } = await db.from("payments").insert({
      user_id: user.id,
      assessment_id: assessmentId,
      amount: amountRupees,
      currency: "INR",
      status: "pending",
      gateway: "razorpay",
      receipt,
    }).select("id").single();

    if (reserveError?.code === "23505") {
      return safeError(409, "order_in_progress", "A payment order is already being prepared. Please retry shortly.", true);
    }
    if (reserveError || !reservation) return safeError(500, "payment_reservation_failed", "Could not prepare the payment.", true);

    let razorpayResponse: Response;
    try {
      razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(razorpayKeyId + ":" + razorpaySecret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amountRupees * 100),
          currency: "INR",
          receipt,
          notes: { assessment_id: assessmentId, user_id: user.id },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      await db.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", reservation.id);
      console.error("Razorpay order request failed", {
        paymentId: reservation.id,
        reason: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error",
      });
      return safeError(502, "gateway_order_failed", "Razorpay could not create the payment order. Please try again.", true);
    }

    const raw = await razorpayResponse.text();
    if (!razorpayResponse.ok) {
      await db.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", reservation.id);
      console.error("Razorpay order request was rejected", {
        paymentId: reservation.id,
        status: razorpayResponse.status,
      });
      return safeError(502, "gateway_order_failed", "Razorpay could not create the payment order. Please try again.", true);
    }

    let order: { id?: string; amount?: number; currency?: string };
    try {
      order = JSON.parse(raw);
    } catch {
      await db.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", reservation.id);
      console.error("Razorpay returned an invalid order response", { paymentId: reservation.id });
      return safeError(502, "gateway_invalid_response", "Razorpay returned an invalid response. Please try again.", true);
    }
    if (!order.id || !order.amount || !order.currency) {
      await db.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", reservation.id);
      console.error("Razorpay returned an incomplete order response", { paymentId: reservation.id });
      return safeError(502, "gateway_invalid_response", "Razorpay returned an invalid response. Please try again.", true);
    }
    const { error: updateError } = await db.from("payments")
      .update({ order_id: order.id, updated_at: new Date().toISOString() })
      .eq("id", reservation.id)
      .eq("status", "pending");
    if (updateError) {
      await db.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", reservation.id);
      return safeError(500, "order_save_failed", "Payment order could not be saved. Please retry.", true);
    }

    return reply({ success: true, key_id: razorpayKeyId, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch {
    return safeError(500, "payment_order_failed", "Could not start payment. Please try again.", true);
  }
});
