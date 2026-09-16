"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function AdminLoginPage() {
  const supabase = createClient();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: loginId, password });
    if (signInError || !data.user) {
      setError(signInError?.message || "Invalid administrator credentials.");
      setLoading(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (profileError || profile?.role !== "admin") {
      await supabase.auth.signOut();
      setError("This account is not configured as an administrator.");
      setLoading(false);
      return;
    }
    window.location.href = "/admin";
  }

  return <main className="section"><div className="container" style={{maxWidth:650}}>
    <div style={{marginBottom:28}}><a href="/">← CarFix</a></div>
    <div className="card">
      <p className="muted">CarFix Administration</p>
      <h1>Administrator Login</h1>
      <p className="muted">Use your administrator account. Customer accounts cannot access the admin dashboard.</p>
      {error && <div className="card" style={{marginTop:20,border:"1px solid #e11d48"}}><p style={{margin:0}}>{error}</p></div>}
      <form onSubmit={handleSubmit} style={{display:"grid",gap:16,marginTop:24}}>
        <label>Admin ID<input type="email" value={loginId} onChange={(e)=>setLoginId(e.target.value)} placeholder="Admin email" required style={{display:"block",width:"100%",marginTop:6,padding:14,borderRadius:8,border:"1px solid #ccc",boxSizing:"border-box"}} /></label>
        <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Admin password" required style={{display:"block",width:"100%",marginTop:6,padding:14,borderRadius:8,border:"1px solid #ccc",boxSizing:"border-box"}} /></label>
        <button className="btn primary" type="submit" disabled={loading}>{loading ? "Signing in..." : "Admin Sign in"}</button>
      </form>
      <p style={{marginTop:18}}><a href="/login">Customer login</a></p>
    </div>
  </div></main>;
}
