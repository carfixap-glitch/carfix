"use client";

import { FormEvent, useCallback, useState } from "react";
import { Turnstile } from "@/components/turnstile";
import { createClient } from "@/lib/supabase";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function AdminLoginPage() {
  const supabase = createClient();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const setCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!turnstileSiteKey) {
      setError("Security verification is unavailable. Please contact support.");
      return;
    }
    if (!captchaToken) {
      setError("Complete the security check before signing in.");
      return;
    }

    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginId.trim(),
      password,
      options: { captchaToken },
    });
    setCaptchaToken("");
    setCaptchaKey((value) => value + 1);

    if (signInError || !data.user) {
      setError(
        signInError?.code === "captcha_failed"
          ? "Security verification failed. Complete the check and try again."
          : "Invalid administrator credentials.",
      );
      setLoading(false);
      return;
    }

    const { data: isAdmin, error: adminCheckError } = await supabase.rpc("is_admin");
    if (adminCheckError || isAdmin !== true) {
      await supabase.auth.signOut();
      setError("Invalid administrator credentials.");
      setLoading(false);
      return;
    }

    window.location.href = "/admin/mfa";
  }

  return (
    <main className="auth-page">
      <div className="auth-orb" />
      <a className="auth-logo" href="/">Car<span>Fix</span></a>
      <div className="auth-card admin-auth-card">
        <div className="auth-kicker">CONTROL CENTER</div>
        <h1>Admin access.</h1>
        <p className="muted">Sign in with your administrator account to manage customers and assessments.</p>
        {error && <div className="auth-message auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Admin ID<input type="email" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="Admin email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" required /></label>
          <Turnstile key={captchaKey} siteKey={turnstileSiteKey} onToken={setCaptcha} />
          <button className="home-primary-btn auth-submit" type="submit" disabled={loading || !captchaToken}>{loading ? "Signing in..." : "Enter Admin Dashboard"}</button>
        </form>
        <p className="auth-bottom"><a href="/login">← Customer login</a></p>
      </div>
    </main>
  );
}
