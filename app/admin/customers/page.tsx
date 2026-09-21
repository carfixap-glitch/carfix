"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Customer={id:string;full_name:string|null;phone:string|null;email:string|null;created_at:string;assessmentCount:number};

export default function AdminCustomersPage(){
  const supabase=createClient();
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [filter,setFilter]=useState("");

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user){window.location.href="/login";return;}
    const {data:adminCheck,error:adminError}=await supabase.from("profiles").select("role").eq("id",user.id).single();
    if(adminError||adminCheck?.role!=="admin"){window.location.href="/dashboard";return;}
    const [{data:profiles,error:pe},{data:assessments,error:ae}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,phone,email,created_at").eq("role","customer").order("created_at",{ascending:false}),
      supabase.from("assessments").select("user_id")
    ]);
    if(pe)throw new Error(pe.message); if(ae)throw new Error(ae.message);
    const counts=new Map<string,number>(); (assessments??[]).forEach((a:any)=>{if(a.user_id)counts.set(a.user_id,(counts.get(a.user_id)??0)+1);});
    setCustomers((profiles??[]).map((p:any)=>({...p,assessmentCount:counts.get(p.id)??0}))); setLoading(false);
  })().catch(e=>{setError(e instanceof Error?e.message:"Could not load customers");setLoading(false);});},[]);

  async function logout(){await supabase.auth.signOut();window.location.href="/";}
  if(loading)return <main className="section"><div className="container">Loading customers...</div></main>;
  const visible=customers.filter(c=>`${c.full_name??""} ${c.email??""} ${c.phone??""}`.toLowerCase().includes(filter.toLowerCase()));

  return <main>
    <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
      <div className="brand"><span>Car</span>Fix <small style={{fontSize:13,marginLeft:8}}>Admin</small></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><a className="btn" href="/admin">📋 Assessments</a><button className="btn" onClick={logout}>Sign out</button></div>
    </div></header>

    <section className="section"><div className="container">
      <p className="muted">Administration</p><h1>👥 Customers</h1><p className="muted">Open a customer profile to manage their manual assessments.</p>
      {error&&<div className="card" style={{marginTop:20}}><p>{error}</p></div>}
      <div className="card" style={{marginTop:24}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><h2>Customer accounts</h2><p className="muted" style={{marginTop:4}}>{customers.length} registered customer{customers.length===1?"":"s"}</p></div><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search name, phone or email" style={{padding:12,borderRadius:8,border:"1px solid #ccc",minWidth:280}} /></div>
        <div style={{display:"grid",gap:12,marginTop:18}}>
          {visible.map(c=><div key={c.id} className="card" style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{c.full_name||"Customer"}</strong><span className="muted">Joined {new Date(c.created_at).toLocaleDateString("en-IN")}</span></div>
            <p style={{marginTop:8}}><strong>Phone:</strong> {c.phone||"No phone"}</p>
            <p style={{marginTop:4}}><strong>Email:</strong> {c.email||"No email"}</p>
            <p style={{marginTop:4}}><strong>Assessments:</strong> {c.assessmentCount}</p>
            <a className="btn primary" href={`/admin/customers/${c.id}`} style={{marginTop:12}}>Open Customer Profile →</a>
          </div>)}
          {!visible.length&&<p className="muted">No matching customers.</p>}
        </div>
      </div>
    </div></section>
  </main>;
}
