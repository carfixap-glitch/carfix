import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "assessment_not_found"
  | "payment_required"
  | "analysis_in_progress"
  | "openai_credit_exhausted"
  | "openai_spend_limit"
  | "openai_usage_limit"
  | "openai_rate_limit"
  | "openai_unavailable"
  | "openai_timeout"
  | "configuration_error"
  | "analysis_failed";

class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly retryable = false,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

type OpenAIErrorPayload = {
  error?: {
    code?: string | null;
    message?: string;
    type?: string | null;
  };
};

const nonRetryableQuotaCodes = new Set([
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
]);

const reply = (body: unknown, status = 200, extraHeaders: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extraHeaders },
  });

function serverKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed?.default) return parsed.default as string;
    } catch {
      // Fall back to the standard service-role variable.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function parseOpenAIError(raw: string): OpenAIErrorPayload {
  try {
    return JSON.parse(raw) as OpenAIErrorPayload;
  } catch {
    return {};
  }
}

function providerError(status: number, payload: OpenAIErrorPayload, requestId?: string) {
  const code = payload.error?.code ?? "";

  if (code === "credit_balance_exhausted") {
    return new AppError(503, "openai_credit_exhausted", "AI analysis is temporarily unavailable because the service credit balance needs attention.", false, requestId);
  }
  if (code === "organization_spend_limit_exceeded" || code === "project_spend_limit_exceeded") {
    return new AppError(503, "openai_spend_limit", "AI analysis is temporarily unavailable because a service spending limit was reached.", false, requestId);
  }
  if (code === "organization_usage_limit_exceeded") {
    return new AppError(503, "openai_usage_limit", "AI analysis is temporarily unavailable because the service usage limit was reached.", false, requestId);
  }
  if (status === 429) {
    return new AppError(429, "openai_rate_limit", "AI analysis is busy right now. Please wait a moment and try again.", true, requestId);
  }
  if (status === 503) {
    return new AppError(503, "openai_unavailable", "AI analysis is temporarily unavailable. Please try again shortly.", true, requestId);
  }

  return new AppError(502, "analysis_failed", "The AI provider could not complete this assessment.", false, requestId);
}

type OpenAIResult = { raw: string; requestId?: string; providerAttempts: number; latencyMs: number };\n\nasync function callOpenAI(key: string, body: unknown): Promise<OpenAIResult> {\n  const startedAt = Date.now();
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new AppError(504, "openai_timeout", "AI analysis took too long. Please try again.", true);
      }
      throw error;
    }
    const raw = await response.text();
    if (response.ok) return { raw, requestId: response.headers.get("x-request-id") ?? undefined, providerAttempts: attempt + 1, latencyMs: Date.now() - startedAt };

    const payload = parseOpenAIError(raw);
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const code = payload.error?.code ?? "";
    const isRetryable = (response.status === 429 && !nonRetryableQuotaCodes.has(code)) || response.status === 503;
    console.error("OpenAI request failed", { status: response.status, code: code || null, type: payload.error?.type ?? null, requestId: requestId ?? null, attempt: attempt + 1, retryable: isRetryable });
    if (!isRetryable || attempt === maxAttempts - 1) throw providerError(response.status, payload, requestId);

    const retryAfter = response.headers.get("Retry-After");
    const parsedDelay = retryAfter ? Number(retryAfter) : Number.NaN;
    const base = Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay * 1000 : 1000 * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 500);
    await new Promise((resolve) => setTimeout(resolve, Math.min(base + jitter, 15_000)));
  }
  throw new AppError(502, "analysis_failed", "The AI provider could not complete this assessment.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: { code: "invalid_request", message: "Method not allowed.", retryable: false } }, 405);

  let assessmentId = "";
  let userId = "";
  let lockAcquired = false;
  let db: ReturnType<typeof createClient> | null = null;\n  let analysisAttemptId = "";\n  let analysisStartedAt = 0;\n  let analysisAttemptId = "";\n  let analysisStartedAt = 0;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new AppError(401, "unauthorized", "Please sign in again.");

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const adminKey = serverKey();
    if (!url || !anonKey || !adminKey) {
      throw new AppError(500, "configuration_error", "AI analysis is not configured correctly.");
    }

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new AppError(401, "unauthorized", "Please sign in again.");
    userId = user.id;
    db = createClient(url, adminKey);

    const rateLimit = await checkRateLimit(db, userId, "analyze_assessment", 5, 3600);
    if (!rateLimit.allowed) {
      throw new AppError(429, "openai_rate_limit", `Too many AI requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`, true);
    }

    let requestBody: { assessment_id?: unknown };
    try {
      requestBody = await req.json();
    } catch {
      throw new AppError(400, "invalid_request", "A valid assessment ID is required.");
    }
    if (typeof requestBody.assessment_id !== "string" || !requestBody.assessment_id) {
      throw new AppError(400, "invalid_request", "A valid assessment ID is required.");
    }
    assessmentId = requestBody.assessment_id;

    const { data: assessment, error: assessmentError } = await db
      .from("assessments")
      .select("id,city,vehicle_id,status,payment_required,payment_status,vehicles(make,model,year)")
      .eq("id", assessmentId)
      .eq("user_id", userId)
      .single();

    if (assessmentError || !assessment) {
      throw new AppError(404, "assessment_not_found", "Assessment not found.");
    }
    if (assessment.payment_required && assessment.payment_status !== "paid") {
      throw new AppError(402, "payment_required", "Complete payment before starting this AI assessment.");
    }

    if (assessment.status === "completed" || assessment.status === "reviewed") {
      const [{ data: existingAnalysis }, { data: existingEstimate }] = await Promise.all([
        db.from("damage_analysis").select("id").eq("assessment_id", assessmentId).maybeSingle(),
        db.from("repair_estimates").select("id").eq("assessment_id", assessmentId).maybeSingle(),
      ]);
      if (existingAnalysis && existingEstimate) {
        return reply({ success: true, already_completed: true });
      }
    }
    if (assessment.status === "processing") {
      throw new AppError(409, "analysis_in_progress", "This assessment is already being analyzed.", true);
    }
    if (assessment.status === "cancelled") {
      throw new AppError(409, "analysis_failed", "A cancelled assessment cannot be analyzed.");
    }

    const { data: locked, error: lockError } = await db
      .from("assessments")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", assessmentId)
      .eq("user_id", userId)
      .eq("status", assessment.status)
      .select("id")
      .maybeSingle();

    if (lockError) throw new AppError(500, "analysis_failed", "Could not start the assessment safely.");
    if (!locked) throw new AppError(409, "analysis_in_progress", "This assessment is already being analyzed.", true);
    lockAcquired = true;

    const { data: photos, error: photoError } = await db
      .from("assessment_photos")
      .select("storage_path")
      .eq("assessment_id", assessmentId);
    if (photoError) throw new AppError(500, "analysis_failed", "Could not load assessment photos.");
    if (!photos?.length) throw new AppError(400, "invalid_request", "No assessment photos were found.");

    const signedImages = await Promise.all(photos.slice(0, 10).map(async (photo) => {
      const { data, error } = await db!.storage
        .from("carfix-damage-photos")
        .createSignedUrl(photo.storage_path, 600);
      return error || !data?.signedUrl ? null : { type: "input_image", image_url: data.signedUrl };
    }));
    const images = signedImages.filter((image): image is { type: string; image_url: string } => image !== null);
    if (!images.length) throw new AppError(500, "analysis_failed", "Could not securely access the uploaded photos.");

    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) throw new AppError(500, "configuration_error", "AI analysis is not configured correctly.");

    const vehicle = Array.isArray(assessment.vehicles) ? assessment.vehicles[0] : assessment.vehicles;
    const prompt = `
You are CarFix Body Repair & Painting AI.
IMPORTANT SCOPE: This assessment is ONLY for EXTERIOR CAR BODY REPAIR AND PAINTING.
Analyze uploaded vehicle photos strictly for visible exterior body damage a body/paint workshop would handle.
INCLUDE: dents, panel deformation, creases, scratches, scuffs, paint damage, chips, peeling, transfer, clear-coat damage, repairable/repaintable exterior plastic, bumper, fender, door skin, bonnet/hood, boot/tailgate, quarter-panel, roof, side panels, rocker/side-sill exterior, visible exterior rust, blending, repainting, and body-panel repair vs replacement.
DO NOT ASSESS OR PRICE mechanical, electrical, ADAS, tyres/wheels, glass, interior, or hidden damage. If non-body issues are visible, state they are outside scope and do not include them in cost.
For each visible body area identify panel, visible damage, severity (minor/moderate/major/unknown), likely repair/paint approach, painting requirement, approximate Indian-market body repair/painting cost, and assumptions.
Do not double-count the same damage across photos. Give a range and explain uncertainty. Return ONLY valid JSON with exactly:
{"damage_description":"...","severity":"minor | moderate | major | unknown","damaged_parts":["Panel — damage — approach"],"recommendations":["..."],"repair_or_replacement":[{"part":"...","action":"dent repair | scratch repair | plastic repair | repaint | paint blend | panel replacement | no repair needed","painting_required":true,"estimated_cost_min":0,"estimated_cost_max":0}],"estimated_min_cost":0,"estimated_max_cost":0,"estimated_time_min_hours":0,"estimated_time_max_hours":0,"notes":"..."}
Vehicle: Make: ${vehicle?.make || "unknown"} Model: ${vehicle?.model || "unknown"} Year: ${vehicle?.year || "unknown"} City: ${assessment.city || "unknown"}
`;

    const { data: previousAttempts, error: previousAttemptsError } = await db
      .from("ai_analysis_attempts")
      .select("attempt_number")
      .eq("assessment_id", assessmentId)
      .order("attempt_number", { ascending: false })
      .limit(1);
    if (previousAttemptsError) throw new AppError(500, "analysis_failed", "Could not prepare AI attempt tracking.");

    const attemptNumber = (previousAttempts?.[0]?.attempt_number ?? 0) + 1;
    analysisStartedAt = Date.now();
    const { data: attemptRow, error: attemptCreateError } = await db
      .from("ai_analysis_attempts")
      .insert({
        assessment_id: assessmentId,
        user_id: userId,
        attempt_number: attemptNumber,
        status: "started",
        provider: "openai",
        model: "gpt-5.6-luna",
      })
      .select("id")
      .single();
    if (attemptCreateError || !attemptRow) throw new AppError(500, "analysis_failed", "Could not start AI attempt tracking.");
    analysisAttemptId = attemptRow.id;

    const openAIResult = await callOpenAI(openAIKey, {
      model: "gpt-5.6-luna",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...images] }],
      text: { format: { type: "json_object" } },
    });

    const rawResponse = openAIResult.raw;\n\n    let responsePayload: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    try {
      responsePayload = JSON.parse(rawResponse);
    } catch {
      throw new AppError(502, "analysis_failed", "The AI provider returned an invalid response.");
    }
    const outputText = responsePayload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new AppError(502, "analysis_failed", "The AI provider returned no analysis.");

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(outputText);
    } catch {
      throw new AppError(502, "analysis_failed", "The AI provider returned an invalid assessment.");
    }

    const severity = ["minor", "moderate", "major", "unknown"].includes(String(analysis.severity))
      ? String(analysis.severity)
      : "unknown";
    const damagedParts = Array.isArray(analysis.damaged_parts) ? analysis.damaged_parts : [];
    const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    const repairOrReplacement = Array.isArray(analysis.repair_or_replacement) ? analysis.repair_or_replacement : [];

    const { error: analysisSaveError } = await db.from("damage_analysis").upsert({
      assessment_id: assessmentId,
      damage_description: String(analysis.damage_description || "No visible exterior body damage could be determined."),
      severity,
      damaged_parts: damagedParts,
      recommendations,
      repair_or_replacement: repairOrReplacement,
    }, { onConflict: "assessment_id" });
    if (analysisSaveError) throw new AppError(500, "analysis_failed", "Could not save the AI assessment.");

    const { error: estimateSaveError } = await db.from("repair_estimates").upsert({
      assessment_id: assessmentId,
      estimated_min_cost: Number(analysis.estimated_min_cost) || 0,
      estimated_max_cost: Number(analysis.estimated_max_cost) || 0,
      estimated_time_min: Number(analysis.estimated_time_min_hours) || 0,
      estimated_time_max: Number(analysis.estimated_time_max_hours) || 0,
      notes: String(analysis.notes || "Preliminary visual estimate for exterior body repair and painting only; physical inspection may change the result."),
    }, { onConflict: "assessment_id" });
    if (estimateSaveError) throw new AppError(500, "analysis_failed", "Could not save the repair estimate.");

    const { error: completionError } = await db
      .from("assessments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", assessmentId)
      .eq("user_id", userId)
      .eq("status", "processing");
    if (completionError) throw new AppError(500, "analysis_failed", "Could not complete the assessment.");

    lockAcquired = false;
    return reply({ success: true, scope: "car_body_repair_and_painting_only" });
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError(500, "analysis_failed", "AI analysis failed unexpectedly.");

    if (db && analysisAttemptId) {
      const { error: attemptFailError } = await db
        .from("ai_analysis_attempts")
        .update({
          status: appError.code === "openai_timeout" ? "timed_out" : "failed",
          latency_ms: analysisStartedAt ? Date.now() - analysisStartedAt : null,
          error_code: appError.code,
          error_message: appError.message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", analysisAttemptId);
      if (attemptFailError) {
        console.error("Could not record AI attempt failure", { assessmentId, message: attemptFailError.message });
      }
    }

    if (lockAcquired && db && assessmentId && userId) {
      const { error: unlockError } = await db
        .from("assessments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", assessmentId)
        .eq("user_id", userId)
        .eq("status", "processing");
      if (unlockError) console.error("Could not release analysis lock", { assessmentId, message: unlockError.message });
    }

    console.error("CarFix analysis failed", {
      assessmentId: assessmentId || null,
      status: appError.status,
      code: appError.code,
      requestId: appError.requestId ?? null,
    });

    const headers: HeadersInit = {};
    if (appError.status === 429) headers["Retry-After"] = "5";
    return reply({
      error: {
        code: appError.code,
        message: appError.message,
        retryable: appError.retryable,
        request_id: appError.requestId,
      },
    }, appError.status, headers);
  }
});
