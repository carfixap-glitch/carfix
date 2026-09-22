import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

const fail = (status: number, code: string, message: string, retryable = false) =>
  reply({ error: { code, message, retryable } }, status);

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST to verify a payment.");

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return fail(401, "unauthorized", "Please sign in to continue.");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return fail(401, "unauthorized", "Your session has expired. Please sign in again.");

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail(400, "invalid_request", "The payment response is not valid.");
    }
    const assessmentId = String(body.assessment_id ?? "");
    const orderId = String(body.razorpay_order_id ?? "");
    const paymentId = String(body.razorpay_payment_id ?? "");
    const signature = String(body.razorpay_signature ?? "");
    if (!assessmentId || !orderId || !paymentId || !signature) {
      return fail(400, "missing_fields", "Payment verification fields are required.");
    }

    const key = serverKey();
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!key || !secret) return fail(500, "server_configuration", "Payment verification is temporarily unavailable.", true);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, key);

    const { data: assessment, error: assessmentError } = await db.from("assessments")
      .select("id,payment_required,payment_status")
      .eq("id", assessmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (assessmentError) return fail(500, "assessment_lookup_failed", "Could not check this assessment.", true);
    if (!assessment) return fail(404, "assessment_not_found", "Assessment not found.");
    if (!assessment.payment_required) return reply({ success: true, payment_status: "free" });
    if (assessment.payment_status === "paid") return reply({ success: true, payment_status: "paid" });

    const expected = await hmacHex(secret, orderId + "|" + paymentId);
    if (expected !== signature) return fail(400, "invalid_signature", "Payment verification failed.");

    const { data, error } = await db.rpc("finalize_razorpay_payment", {
      p_user_id: user.id,
      p_assessment_id: assessmentId,
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_signature: signature,
    });
    if (error) {
      const known = error.message.includes("not found") || error.message.includes("mismatch");
      return fail(known ? 400 : 500, known ? "payment_not_verified" : "payment_finalize_failed", known ? "Payment verification failed." : "Payment was received but could not be finalized. Please contact support.", !known);
    }
    return reply({ success: true, payment_status: data?.payment_status ?? "paid" });
  } catch {
    return fail(500, "payment_verification_failed", "Payment verification failed. Please contact support.", true);
  }
});
