"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Turnstile } from "@/components/turnstile";
import { createClient } from "@/lib/supabase";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const localNumber = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(localNumber) ? `+91${localNumber}` : null;
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const supabase = createClient();
  const setCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendOtp(event: FormEvent) {
    event.preventDefault();
    if (sending || cooldown > 0) return;
    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) return setMessage("Enter a valid 10-digit Indian mobile number.");
    if (turnstileSiteKey && !captchaToken) return setMessage("Complete the security check before requesting an OTP.");

    setSending(true);
    setMessage("Sending OTP…");
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: false, captchaToken: captchaToken || undefined },
    });
    setCaptchaToken("");
    setCaptchaKey((value) => value + 1);
    setSending(false);
    if (error) return setMessage("We could not send a code. Check the number or wait before retrying.");
    setOtpSent(true);
    setCooldown(60);
    setMessage("OTP sent. Enter the six-digit code below.");
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone || !/^\d{6}$/.test(otp)) return;
    setMessage("Verifying OTP…");
    const { error } = await supabase.auth.verifyOtp({ phone: normalizedPhone, token: otp, type: "sms" });
    if (error) return setMessage("That code is invalid or expired. Request a new code and retry.");
    window.location.href = "/dashboard";
  }

  return <main className="auth-page"><div className="auth-orb"/><a className="auth-logo" href="/">Car<span>Fix</span></a><div className="auth-card"><div className="auth-kicker">CUSTOMER ACCESS</div><h1>Welcome back.</h1><p className="muted">Sign in securely with your verified mobile number.</p>{!otpSent?<form onSubmit={sendOtp} className="auth-form"><label>Mobile number<input type="tel" placeholder="10-digit Indian mobile number" value={phone} onChange={(event)=>setPhone(event.target.value)} required inputMode="tel" maxLength={14}/></label><div className="otp-note"><b>One-time verification</b><br/>We’ll send a secure OTP to your registered number.</div>{turnstileSiteKey&&<Turnstile key={captchaKey} siteKey={turnstileSiteKey} onToken={setCaptcha}/>}<button className="home-primary-btn auth-submit" type="submit" disabled={sending||cooldown>0}>{sending?"Sending…":cooldown>0?`Retry in ${cooldown}s`:"Send OTP"}</button>{message&&<p className="auth-message" role="status">{message}</p>}</form>:<form onSubmit={verifyOtp} className="auth-form"><label>Verification code<input className="otp-input" type="text" placeholder="••••••" value={otp} onChange={(event)=>setOtp(event.target.value.replace(/\D/g,""))} required inputMode="numeric" maxLength={6} autoComplete="one-time-code"/></label><button className="home-primary-btn auth-submit" type="submit" disabled={otp.length!==6}>Verify OTP &amp; Sign in</button><button className="auth-link-btn" type="button" onClick={()=>{setOtpSent(false);setOtp("");setMessage("")}}>Change phone number</button>{message&&<p className="auth-message" role="status">{message}</p>}</form>}<p className="auth-bottom">New to CarFix? <a href="/register">Create an account</a></p></div></main>;
}
