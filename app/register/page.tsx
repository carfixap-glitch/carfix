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

export default function RegisterPage() {
  const [name, setName] = useState("");
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
    if (name.trim().length < 2) return setMessage("Enter your full name.");
    if (turnstileSiteKey && !captchaToken) return setMessage("Complete the security check before requesting an OTP.");

    setSending(true);
    setMessage("Sending OTP…");
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        data: { full_name: name.trim(), phone: normalizedPhone },
        shouldCreateUser: true,
        captchaToken: captchaToken || undefined,
      },
    });
    setCaptchaToken("");
    setCaptchaKey((value) => value + 1);
    setSending(false);
    if (error) return setMessage("We could not send a code. Check the details or wait before retrying.");
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

  return <main className="auth-page"><div className="auth-orb"/><a className="auth-logo" href="/">Car<span>Fix</span></a><div className="auth-card"><div className="auth-kicker">GET STARTED</div><h1>Create your account.</h1><p className="muted">Set up your CarFix account in seconds with mobile verification.</p>{!otpSent?<form onSubmit={sendOtp} className="auth-form"><label>Full name<input type="text" placeholder="Your full name" value={name} onChange={(event)=>setName(event.target.value)} required maxLength={100}/></label><label>Mobile number<input type="tel" placeholder="10-digit Indian mobile number" value={phone} onChange={(event)=>setPhone(event.target.value)} required inputMode="tel" maxLength={14}/></label><div className="otp-note"><b>Secure by design</b><br/>Your number is verified with a one-time password before access.</div>{turnstileSiteKey&&<Turnstile key={captchaKey} siteKey={turnstileSiteKey} onToken={setCaptcha}/>}<p className="auth-consent">By continuing, you agree to the <a href="/terms">Terms of Service</a> and acknowledge the <a href="/privacy">Privacy Policy</a> and <a href="/ai-disclaimer">AI Assessment Disclaimer</a>.</p><button className="home-primary-btn auth-submit" type="submit" disabled={sending||cooldown>0}>{sending?"Sending…":cooldown>0?`Retry in ${cooldown}s`:"Send OTP"}</button>{message&&<p className="auth-message" role="status">{message}</p>}</form>:<form onSubmit={verifyOtp} className="auth-form"><label>Verification code<input className="otp-input" type="text" placeholder="••••••" value={otp} onChange={(event)=>setOtp(event.target.value.replace(/\D/g,""))} required inputMode="numeric" maxLength={6} autoComplete="one-time-code"/></label><button className="home-primary-btn auth-submit" type="submit" disabled={otp.length!==6}>Verify OTP &amp; Create Account</button><button className="auth-link-btn" type="button" onClick={()=>{setOtpSent(false);setOtp("");setMessage("")}}>Change phone number</button>{message&&<p className="auth-message" role="status">{message}</p>}</form>}<p className="auth-bottom">Already registered? <a href="/login">Sign in with OTP</a></p></div></main>;
}
