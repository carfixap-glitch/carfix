type CspReport = {
  blockedURL?: string;
  disposition?: string;
  documentURL?: string;
  effectiveDirective?: string;
  "blocked-uri"?: string;
  "document-uri"?: string;
  "effective-directive"?: string;
  "violated-directive"?: string;
};

const MAX_REPORT_BYTES = 16 * 1024;
const MAX_REPORTS_PER_MINUTE = 100;

let reportWindowStartedAt = Date.now();
let reportsInWindow = 0;

function originOnly(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (["inline", "eval", "data", "blob"].includes(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function withinReportLimit() {
  const now = Date.now();
  if (now - reportWindowStartedAt >= 60_000) {
    reportWindowStartedAt = now;
    reportsInWindow = 0;
  }
  reportsInWindow += 1;
  return reportsInWindow <= MAX_REPORTS_PER_MINUTE;
}

function normalizeReports(value: unknown): CspReport[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (record["csp-report"] && typeof record["csp-report"] === "object") {
      return [record["csp-report"] as CspReport];
    }
    if (record.body && typeof record.body === "object") {
      return [record.body as CspReport];
    }
    return [record as CspReport];
  });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REPORT_BYTES || !withinReportLimit()) {
    return new Response(null, { status: 204 });
  }

  try {
    const text = await request.text();
    if (!text || new TextEncoder().encode(text).byteLength > MAX_REPORT_BYTES) {
      return new Response(null, { status: 204 });
    }

    const reports = normalizeReports(JSON.parse(text)).slice(0, 10);
    for (const report of reports) {
      console.warn(JSON.stringify({
        event: "csp_violation",
        directive:
          report.effectiveDirective ??
          report["effective-directive"] ??
          report["violated-directive"] ??
          "unknown",
        disposition: report.disposition ?? "report",
        blockedOrigin: originOnly(report.blockedURL ?? report["blocked-uri"]),
        documentOrigin: originOnly(report.documentURL ?? report["document-uri"]),
      }));
    }
  } catch {
    // Browsers do not need a response body for malformed or unsupported reports.
  }

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
