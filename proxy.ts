import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const path = request.nextUrl.pathname;
  if (path === "/admin/login") return response;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) return NextResponse.redirect(new URL("/admin/login", request.url));

  if (path === "/admin/mfa") {
    return assurance.currentLevel === "aal2"
      ? NextResponse.redirect(new URL("/admin", request.url))
      : response;
  }

  return assurance.currentLevel === "aal2"
    ? response
    : NextResponse.redirect(new URL("/admin/mfa", request.url));
}

export const config = { matcher: ["/admin/:path*"] };
