"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicAdminRoute = pathname === "/admin/login";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPublicAdminRoute) return;

    let active = true;
    const supabase = createClient();

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
      if (!active) return;
      if (adminError || isAdmin !== true) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assuranceError) {
        router.replace("/admin/login");
        return;
      }

      const hasAal2 = assurance.currentLevel === "aal2";
      if (pathname === "/admin/mfa") {
        if (hasAal2) router.replace("/admin");
        else setReady(true);
        return;
      }

      if (!hasAal2) {
        router.replace("/admin/mfa");
        return;
      }

      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [isPublicAdminRoute, pathname, router]);

  if (!isPublicAdminRoute && !ready) {
    return <main className="auth-page"><div className="auth-card"><p>Verifying administrator access…</p></div></main>;
  }

  return children;
}
