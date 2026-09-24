import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function proxy(request: NextRequest) {
  const incomingRequestId = request.headers.get("x-request-id");
  const requestId =
    incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const nextResponse = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    next.headers.set("x-request-id", requestId);
    return next;
  };
  const redirect = (path: string) => {
    const redirected = NextResponse.redirect(new URL(path, request.url));
    redirected.headers.set("x-request-id", requestId);
    return redirected;
  };

  let response = nextResponse();
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/admin") || path === "/admin/login") return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextResponse();
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/admin/login");

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    if (adminError) {
      console.error(JSON.stringify({
        event: "admin_authorization_failed",
        requestId,
        path,
        errorCode: adminError.code,
      }));
    }
    return redirect("/login");
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) {
    console.error(JSON.stringify({
      event: "admin_assurance_check_failed",
      requestId,
      path,
      errorCode: assuranceError.code,
    }));
    return redirect("/admin/login");
  }

  if (path === "/admin/mfa") {
    return assurance.currentLevel === "aal2"
      ? redirect("/admin")
      : response;
  }

  return assurance.currentLevel === "aal2"
    ? response
    : redirect("/admin/mfa");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
