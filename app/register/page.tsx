"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

function normalizePhone(value: string) {
 const digits = value.replace(new RegExp("\\D","g"),"");
 return digits.startsWith("91") ? "+" + digits : "+91" + digits;
}

export default function RegisterPage() {
 const [name,setName]=useState("");
 const [phone,setPhone]=useState("");
 const [otp,setOtp]=useState("");
 const [otpSent,setOtpSent]=useState(false);
 const [message,setMessage]=useState("");
 const supabase=createClient();

 async function sendOtp(e: FormEvent) {
  e.preventDefault();
  setMessage("Sending OTP...");
  const normalizedPhone=normalizePhone(phone);
  if(normalizedPhone.length!==13)return setMessage("Enter a valid 10-digit Indian mobile number.");

  const {error}=await supabase.auth.signInWithOtp({
   phone:normalizedPhone,
   options:{
    data:{full_name:name,phone:normalizedPhone},
    shouldCreateUser:true
   }
  });

  if(error)return setMessage(error.message);
  setOtpSent(true);
  setMessage("OTP sent to your WhatsApp/SMS. Enter the 6-digit code below.");
 }

 async function verifyOtp(e: FormEvent) {
  e.preventDefault();
  setMessage("Verifying OTP...");
  const normalizedPhone=normalizePhone(phone);

  const {error}=await supabase.auth.verifyOtp({
   phone:normalizedPhone,
   token:otp,
   type:"sms"
  });

  if(error)return setMessage(error.message);
  window.location.href="/dashboard";
 }

 return <main className="section">
  <div className="container" style={{maxWidth:520}}>
   <a href="/">← CarFix</a>
   <div className="card" style={{marginTop:25}}>
    <h1>Create your account</h1>
    <p className="muted">Create your CarFix account using your mobile number.</p>

    {!otpSent ? (
     <form onSubmit={sendOtp} style={{display:"grid",gap:14,marginTop:25}}>
      <input type="text" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} required style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}/>
      <input type="tel" placeholder="Phone number (10 digits)" value={phone} onChange={e=>setPhone(e.target.value)} required inputMode="numeric" maxLength={10} style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}/>
      <button className="btn primary" type="submit">Send OTP</button>
      {message&&<p className="muted">{message}</p>}
     </form>
    ) : (
     <form onSubmit={verifyOtp} style={{display:"grid",gap:14,marginTop:25}}>
      <input type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={e=>setOtp(e.target.value.replace(new RegExp("\\D","g"),""))} required inputMode="numeric" maxLength={6} autoComplete="one-time-code" style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}/>
      <button className="btn primary" type="submit">Verify OTP & Create Account</button>
      <button type="button" onClick={()=>{setOtpSent(false);setOtp("");setMessage("");}} style={{padding:10,background:"transparent",border:0,cursor:"pointer"}}>Change phone number</button>
      {message&&<p className="muted">{message}</p>}
     </form>
    )}

    <p className="muted" style={{marginTop:20}}>Already registered? <a href="/login" style={{color:"#2563eb"}}>Sign in with OTP</a></p>
   </div>
  </div>
 </main>;
}