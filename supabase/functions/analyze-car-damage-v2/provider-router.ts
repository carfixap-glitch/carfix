export type ProviderName = "openai" | "gemini";

export type ProviderSelection = {
  provider: ProviderName;
  model: string;
  reason: "primary_ready" | "primary_precheck_failed";
};

export type ProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ProviderResult = {
  provider: ProviderName;
  model: string;
  outputText: string;
  requestId?: string;
  providerAttempts: number;
  latencyMs: number;
  usage: ProviderUsage;
  fallbackReason?: string;
};

export class ProviderRouterError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

const OPENAI_MODEL = "gpt-5.6-luna";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const openAINonFallbackCodes = new Set([
  "invalid_request_error",
  "model_not_found",
]);

async function readinessFetch(url: string, headers: HeadersInit) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function selectAssessmentProvider(openAIKey: string, geminiKey: string): Promise<ProviderSelection> {
  if (openAIKey) {
    const ready = await readinessFetch(
      `https://api.openai.com/v1/models/${OPENAI_MODEL}`,
      { Authorization: `Bearer ${openAIKey}` },
    );
    if (ready) return { provider: "openai", model: OPENAI_MODEL, reason: "primary_ready" };
  }

  if (geminiKey) {
    const ready = await readinessFetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}`,
      { "x-goog-api-key": geminiKey },
    );
    if (ready) return { provider: "gemini", model: GEMINI_MODEL, reason: "primary_precheck_failed" };
  }

  throw new ProviderRouterError("openai", 503, "no_ai_provider_available", "AI assessment providers are temporarily unavailable. Please try again shortly.", true);
}

function parseJson(raw: string): any {
  try { return JSON.parse(raw); } catch { return {}; }
}

function openAIError(response: Response, raw: string) {
  const payload = parseJson(raw);
  const providerCode = String(payload?.error?.code ?? "");
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
  const fallbackEligible = retryable ||
    providerCode === "credit_balance_exhausted" ||
    providerCode === "organization_spend_limit_exceeded" ||
    providerCode === "project_spend_limit_exceeded" ||
    providerCode === "organization_usage_limit_exceeded";
  const code = providerCode || `openai_http_${response.status}`;
  const error = new ProviderRouterError("openai", response.status, code, "OpenAI could not complete the assessment.", fallbackEligible, requestId);
  return { error, fallbackEligible: fallbackEligible && !openAINonFallbackCodes.has(providerCode) };
}

async function callOpenAI(key: string, prompt: string, imageUrls: string[]): Promise<ProviderResult> {
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...imageUrls.map((image_url) => ({ type: "input_image", image_url })),
          ],
        }],
        text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ProviderRouterError("openai", 504, "openai_timeout", "OpenAI timed out.", true);
    }
    throw new ProviderRouterError("openai", 503, "openai_network_error", "OpenAI is temporarily unreachable.", true);
  }

  const raw = await response.text();
  if (!response.ok) throw openAIError(response, raw).error;

  const payload = parseJson(raw);
  const outputText = payload?.output
    ?.flatMap((item: any) => item?.content ?? [])
    .find((item: any) => item?.type === "output_text")?.text;
  if (!outputText) throw new ProviderRouterError("openai", 502, "openai_empty_response", "OpenAI returned no assessment.", false, response.headers.get("x-request-id") ?? undefined);

  return {
    provider: "openai",
    model: OPENAI_MODEL,
    outputText,
    requestId: response.headers.get("x-request-id") ?? undefined,
    providerAttempts: 1,
    latencyMs: Date.now() - started,
    usage: {
      inputTokens: payload?.usage?.input_tokens,
      outputTokens: payload?.usage?.output_tokens,
      totalTokens: payload?.usage?.total_tokens,
    },
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

async function geminiImageParts(imageUrls: string[]) {
  const parts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  for (const url of imageUrls) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new ProviderRouterError("gemini", 502, "gemini_image_fetch_failed", "Could not prepare an assessment photo for Gemini.", true);
    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const bytes = new Uint8Array(await response.arrayBuffer());
    parts.push({ inlineData: { mimeType: contentType, data: bytesToBase64(bytes) } });
  }
  return parts;
}

async function callGemini(key: string, prompt: string, imageUrls: string[]): Promise<ProviderResult> {
  const started = Date.now();
  const imageParts = await geminiImageParts(imageUrls);
  let response: Response;
  try {
    response = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ProviderRouterError("gemini", 504, "gemini_timeout", "Gemini timed out.", true);
    }
    throw new ProviderRouterError("gemini", 503, "gemini_network_error", "Gemini is temporarily unreachable.", true);
  }

  const raw = await response.text();
  const payload = parseJson(raw);
  const requestId = response.headers.get("x-request-id") ?? payload?.responseId ?? undefined;
  if (!response.ok) {
    const code = String(payload?.error?.status ?? payload?.error?.code ?? `gemini_http_${response.status}`);
    throw new ProviderRouterError("gemini", response.status, code, "Gemini could not complete the assessment.", response.status === 429 || response.status >= 500, requestId);
  }

  const outputText = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
  if (!outputText) throw new ProviderRouterError("gemini", 502, "gemini_empty_response", "Gemini returned no assessment.", false, requestId);

  return {
    provider: "gemini",
    model: payload?.modelVersion || GEMINI_MODEL,
    outputText,
    requestId,
    providerAttempts: 1,
    latencyMs: Date.now() - started,
    usage: {
      inputTokens: payload?.usageMetadata?.promptTokenCount,
      outputTokens: payload?.usageMetadata?.candidatesTokenCount,
      totalTokens: payload?.usageMetadata?.totalTokenCount,
    },
  };
}

export async function runAssessmentWithFallback(args: {
  selection: ProviderSelection;
  openAIKey: string;
  geminiKey: string;
  prompt: string;
  imageUrls: string[];
}): Promise<ProviderResult> {
  if (args.selection.provider === "gemini") {
    return callGemini(args.geminiKey, args.prompt, args.imageUrls);
  }

  try {
    return await callOpenAI(args.openAIKey, args.prompt, args.imageUrls);
  } catch (error) {
    if (!(error instanceof ProviderRouterError) || !error.retryable || !args.geminiKey) throw error;

    const geminiReady = await readinessFetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}`,
      { "x-goog-api-key": args.geminiKey },
    );
    if (!geminiReady) throw error;

    const result = await callGemini(args.geminiKey, args.prompt, args.imageUrls);
    return { ...result, fallbackReason: error.code };
  }
}
