"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const supabase = createClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(error.message);
    window.location.href = "/dashboard";
  }

  return <main className="section"><div className="container" style={{maxWidth:520}}><a href="/">← CarFix</a><div className="card" style={{marginTop:25}}><h1>Welcome back</h1><p className="muted">Sign in to view your vehicle assessments.</p><form onSubmit={submit} style={{display:"grid",gap:14,marginTop:25}}><input aria-label="Email" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}/><input aria-label="Password" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}/><button className="btn primary" type="submit">Sign in</button>{message && <p className="muted">{message}</p>}</form><p className="muted" style={{marginTop:20}}>New to CarFix? <a href="/register" style={{color:"#2563eb"}}>Create an account</a></p></div></div></main>;
}
