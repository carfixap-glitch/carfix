"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function RegisterPage() {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  const supabase = createClient();
  async function submit(e: FormEvent) { e.preventDefault(); setMessage("Creating account..."); const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, phone } } }); if (error) return setMessage(error.message); if (data.session) window.location.href="/dashboard"; else setMessage("Account created. Check your email if confirmation is enabled, then sign in."); }
  const field=(placeholder:string,value:string,setter:(v:string)=>void,type="text")=><input type={type} placeholder={placeholder} value={value} onChange={e=>setter(e.target.value)} required style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}/>;
  return <main className="section"><div className="container" style={{maxWidth:520}}><a href="/">← CarFix</a><div className="card" style={{marginTop:25}}><h1>Create your account</h1><p className="muted">Save and track your car damage assessments.</p><form onSubmit={submit} style={{display:"grid",gap:14,marginTop:25}}>{field("Full name",name,setName)}{field("Phone",phone,setPhone)}{field("Email",email,setEmail,"email")}{field("Password",password,setPassword,"password")}<button className="btn primary" type="submit">Create account</button>{message&&<p className="muted">{message}</p>}</form><p className="muted" style={{marginTop:20}}>Already registered? <a href="/login" style={{color:"#2563eb"}}>Sign in</a></p></div></div></main>;
}
