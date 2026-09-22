"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Assessment={id:string;city:string|null;status:string|null;created_at:string;payment_required?:boolean;payment_status?:string;payment_amount?:number;vehicle:{make:string|null;model:string|null;year:number|null}|null;severity?:string|null;minCost?:number|null;maxCost?:number|null};

export default function DashboardPage(){
 const [email,setEmail]=useState(""),[assessments,setAssessments]=useState<Assessment[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const supabase=createClient();
 useEffect(()=>{(async()=>{try{
  const {data:{user}}=await supabase.auth.getUser(); if(!user){window.location.href="/login";return} setEmail(user.email??"");
  const {data:rows,error:ae}=await supabase.from("assessments").select("id,vehicle_id,city,status,created_at,payment_required,payment_status,payment_amount").eq("user_id",user.id).order("created_at",{ascending:false}); if(ae)throw new Error(ae.message);
  const base=rows??[]; if(!base.length){setLoading(false);return}
  const vids=[...new Set(base.map((x:any)=>x.vehicle_id).filter(Boolean))],ids=base.map((x:any)=>x.id);
  const [{data:vehicles},{data:analyses},{data:estimates}]=await Promise.all([
   vids.length?supabase.from("vehicles").select("id,make,model,year").in("id",vids):Promise.resolve({data:[] as any[]}),
   supabase.from("damage_analysis").select("assessment_id,severity").in("assessment_id",ids),
   supabase.from("repair_estimates").select("assessment_id,estimated_min_cost,estimated_max_cost").in("assessment_id",ids)
  ]);
  const vm=new Map((vehicles??[]).map((v:any)=>[v.id,v])),am=new Map((analyses??[]).map((a:any)=>[a.assessment_id,a])),em=new Map((estimates??[]).map((e:any)=>[e.assessment_id,e]));
  setAssessments(base.map((a:any)=>({id:a.id,city:a.city,status:a.status,created_at:a.created_at,payment_required:a.payment_required,payment_status:a.payment_status,payment_amount:a.payment_amount,vehicle:vm.get(a.vehicle_id)??null,severity:am.get(a.id)?.severity??null,minCost:em.get(a.id)?.estimated_min_cost??null,maxCost:em.get(a.id)?.estimated_max_cost??null}))); setLoading(false);
 }catch(e){setError(e instanceof Error?e.message:"Could not load dashboard");setLoading(false)}})()},[]);
 async function logout(){await supabase.auth.signOut();window.location.href="/"}
 if(loading)return <main className="dashboard-page"><header className="nav"><div className="container"><span className="brand"><span>Car</span>Fix.</span></div></header><section className="section"><div className="container" aria-live="polite" aria-busy="true"><div className="dashboard-skeleton dashboard-skeleton-hero"/><div className="dashboard-stats-grid"><div className="dashboard-skeleton"/><div className="dashboard-skeleton"/><div className="dashboard-skeleton"/></div><div className="dashboard-skeleton dashboard-skeleton-list"/><span className="sr-only">Loading your CarFix workspace…</span></div></section></main>;
 const completed=assessments.filter(a=>a.status==="completed").length;
 return <main className="dashboard-page">
  <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><a className="brand" href="/"><span>Car</span>Fix.</a><div style={{display:"flex",gap:10,alignItems:"center"}}><span className="muted" style={{fontSize:12}}>{email}</span><button className="btn" onClick={logout}>Sign out</button></div></div></header>
  <section className="section"><div className="container">
   <div className="dashboard-hero"><div style={{position:"relative",zIndex:1}}><div className="home-kicker">YOUR CARFIX WORKSPACE</div><h1>Your car. Your answers.</h1><p>Track your assessments, review AI findings and keep every repair decision in one place.</p><a className="home-primary-btn" href="/assessments/new" style={{marginTop:20}}>Start new assessment <span>→</span></a></div></div>
   {error&&<div className="card" style={{marginTop:20}}><p>{error}</p></div>}
   <div className="dashboard-stats-grid">
    <div className="app-stat"><span>Total assessments</span><strong>{assessments.length}</strong></div><div className="app-stat"><span>Completed</span><strong>{completed}</strong></div><div className="app-stat"><span>Photo-first AI reports</span><strong>AI</strong></div>
   </div>
   <div className="dashboard-list-heading"><div><div className="home-kicker">ASSESSMENT HISTORY</div><h2>Your recent assessments</h2></div><a className="btn primary" href="/assessments/new">+ New assessment</a></div>
   {!assessments.length?<div className="card" style={{marginTop:20,textAlign:"center",padding:55}}><div style={{fontSize:38}}>🚗</div><h3>No assessments yet</h3><p className="muted">Upload your first damage photos and let CarFix inspect the visible body damage.</p><a className="btn primary" href="/assessments/new" style={{marginTop:14}}>Create your first assessment</a></div>:
   <div className="assessment-list">{assessments.map(item=><a key={item.id} href={`/assessments/${item.id}`} className="assessment-card dashboard-assessment-card">
    <div><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><h3 style={{margin:0}}>{item.vehicle?.make??"Vehicle"} {item.vehicle?.model??""}</h3><span className="home-pill">{item.payment_required && item.payment_status !== "paid" ? "Payment required" : item.status??"pending"}</span></div><p className="muted" style={{margin:"8px 0"}}>{item.city||"Location captured"} · {new Date(item.created_at).toLocaleDateString("en-IN")}</p>{item.severity&&<p style={{margin:"8px 0"}}><strong>AI severity:</strong> {item.severity}</p>}</div>
    <div className="dashboard-assessment-cost">{item.minCost!=null&&item.maxCost!=null?<><small className="muted">ESTIMATED REPAIR</small><strong>₹{Number(item.minCost).toLocaleString("en-IN")} – ₹{Number(item.maxCost).toLocaleString("en-IN")}</strong></>:<span className="muted">{item.payment_required && item.payment_status !== "paid" ? `₹${Number(item.payment_amount || 199).toLocaleString("en-IN")} · Pay now →` : "View assessment →"}</span>}</div>
   </a>)}</div>}
  </div></section>
 </main>
}
