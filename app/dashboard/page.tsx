"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function DashboardPage() {
  const [email,setEmail]=useState(""); const [loading,setLoading]=useState(true); const supabase=createClient();
  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(!data.user) window.location.href="/login"; else {setEmail(data.user.email??"");setLoading(false)}})},[]);
  async function logout(){await supabase.auth.signOut();window.location.href="/";}
  if(loading)return <main className="section"><div className="container">Loading dashboard...</div></main>;
  return <main><header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="brand"><span>Car</span>Fix</div><button className="btn" onClick={logout}>Sign out</button></div></header><section className="section"><div className="container"><p className="muted">Customer dashboard</p><h1>Your assessments</h1><p className="muted">Signed in as {email}</p><div className="grid" style={{gridTemplateColumns:"repeat(2,1fr)"}}><div className="card"><h3>Start a new assessment</h3><p>Enter your vehicle details and upload damage photos.</p><a className="btn primary" href="/assessments/new" style={{marginTop:18}}>New assessment</a></div><div className="card"><h3>Assessment history</h3><p>Your saved assessments and repair estimates will appear here.</p><p className="muted" style={{marginTop:18}}>No assessments loaded yet.</p></div></div></div></section></main>;
}
