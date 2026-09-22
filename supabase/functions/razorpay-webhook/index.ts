import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
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

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const key = serverKey();
  if (!secret || !key) return json({ error: "server_configuration" }, 500);

  const rawBody = await req.text();
  const suppliedSignature = req.headers.get("x-razorpay-signature") ?? "";
  if (!suppliedSignature || await hmacHex(secret, rawBody) !== suppliedSignature) {
    return json({ error: "invalid_signature" }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const payment = event?.payload?.payment?.entity;
  if (!payment?.id || !payment?.order_id) return json({ received: true });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, key);

  if (event.event === "payment.captured") {
    const { error } = await db.rpc("reconcile_razorpay_webhook", {
      p_order_id: payment.order_id,
      p_payment_id: payment.id,
      p_amount_paise: Number(payment.amount),
      p_status: "paid",
    });
    if (error) return json({ error: "reconciliation_failed" }, 500);
  } else if (event.event === "payment.failed") {
    const { error } = await db.rpc("reconcile_razorpay_webhook", {
      p_order_id: payment.order_id,
      p_payment_id: payment.id,
      p_amount_paise: Number(payment.amount),
      p_status: "failed",
    });
    if (error) return json({ error: "reconciliation_failed" }, 500);
  }

  return json({ received: true });
});
