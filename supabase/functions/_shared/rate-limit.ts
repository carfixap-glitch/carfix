import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  db: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await db.rpc("consume_request_limit", {
    p_user_id: userId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw new Error("rate_limit_unavailable");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") throw new Error("rate_limit_unavailable");

  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || 1),
  };
}
