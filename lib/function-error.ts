type FunctionErrorBody = {
  error?: string | {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
};

export async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.clone().json() as FunctionErrorBody;
        if (typeof body.error === "string" && body.error.trim()) return body.error;
        if (body.error && typeof body.error === "object" && body.error.message) {
          return body.error.message;
        }
      } catch {
        // Fall through to the SDK error when the response body is unavailable.
      }
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
