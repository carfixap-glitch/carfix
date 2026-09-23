"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Enrollment = { factorId: string; qrCode: string; secret: string };

export default function AdminMfaPage() {
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Checking your security setup…");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const prepare = useCallback(async () => {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const verifiedFactor = factors.totp.find((factor) => factor.status === "verified");
    if (verifiedFactor) {
      setFactorId(verifiedFactor.id);
      setMessage("Enter the six-digit code from your authenticator app.");
      setLoading(false);
      return;
    }

    // Remove abandoned unverified enrollments before creating a fresh QR code.
    for (const factor of factors.all.filter((item) => item.status === "unverified")) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "CarFix Admin",
    });
    if (error) throw error;
    setFactorId(data.id);
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setMessage("Scan this QR code with an authenticator app, then enter its six-digit code.");
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void prepare().catch(() => {
        setMessage("We could not prepare multi-factor authentication. Sign in again and retry.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [prepare]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code) || !factorId) return;
    setLoading(true);
    setMessage("Verifying code…");

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setMessage("The verification challenge could not be created. Please retry.");
      setLoading(false);
      return;
    }

    const result = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (result.error) {
      setMessage("That code was not accepted. Wait for a new code and try again.");
      setCode("");
      setLoading(false);
      return;
    }

    window.location.assign("/admin");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  return <main className="auth-page"><div className="auth-orb"/><a className="auth-logo" href="/">Car<span>Fix</span></a><div className="auth-card admin-auth-card"><div className="auth-kicker">ADMIN SECURITY</div><h1>Two-step verification.</h1><p className="muted">Administrator access requires a password and an authenticator code.</p>{enrollment&&<div className="mfa-enrollment"><img src={enrollment.qrCode} alt="Authenticator enrollment QR code" width={220} height={220}/><p className="muted">Can’t scan it? Enter this setup key:</p><code>{enrollment.secret}</code></div>}<p className="auth-message" role="status">{message}</p><form className="auth-form" onSubmit={verify}><label>Authenticator code<input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,""))} disabled={loading}/></label><button className="home-primary-btn auth-submit" type="submit" disabled={loading||code.length!==6}>{loading?"Please wait…":"Verify and continue"}</button><button className="auth-link-btn" type="button" onClick={signOut}>Sign out</button></form></div></main>;
}
