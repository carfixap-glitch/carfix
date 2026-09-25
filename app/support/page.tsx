"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type Assessment = { id:string; city:string|null; created_at:string };
type Ticket = { id:string; ticket_number:string; category:string; subject:string; status:string; assessment_id:string|null; created_at:string; updated_at:string };
type Message = { id:string; sender_type:string; message:string; created_at:string };

const categories=[
 ["assessment_issue","Assessment issue"],["payment_issue","Payment issue"],["ai_result_question","AI result question"],
 ["account_issue","Account issue"],["privacy_data_request","Privacy / data request"],["technical_problem","Technical problem"],["other_grievance","Other grievance"]
] as const;
const labels=Object.fromEntries(categories) as Record<string,string>;

export default function SupportPage(){
 const supabase=useMemo(()=>createClient(),[]);
 const [userId,setUserId]=useState(""),[tickets,setTickets]=useState<Ticket[]>([]),[assessments,setAssessments]=useState<Assessment[]>([]);
 const [selected,setSelected]=useState<Ticket|null>(null),[messages,setMessages]=useState<Message[]>([]);
 const [category,setCategory]=useState("assessment_issue"),[assessmentId,setAssessmentId]=useState(""),[subject,setSubject]=useState(""),[firstMessage,setFirstMessage]=useState("");
 const [reply,setReply]=useState(""),[assistantQuestion,setAssistantQuestion]=useState(""),[assistantAnswer,setAssistantAnswer]=useState(""),[assistantEscalate,setAssistantEscalate]=useState(false),[assistantBusy,setAssistantBusy]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");

 async function loadTickets(uid:string){
  const {data,error}=await supabase.from("support_tickets").select("id,ticket_number,category,subject,status,assessment_id,created_at,updated_at").eq("user_id",uid).order("created_at",{ascending:false});
  if(error) throw error; setTickets((data??[]) as Ticket[]);
 }
 useEffect(()=>{(async()=>{try{
  const {data:{user}}=await supabase.auth.getUser(); if(!user){window.location.href="/login";return} setUserId(user.id);
  const [{data:ar,error:ae}]=await Promise.all([supabase.from("assessments").select("id,city,created_at").eq("user_id",user.id).order("created_at",{ascending:false})]);
  if(ae)throw ae; setAssessments((ar??[]) as Assessment[]); await loadTickets(user.id);
 }catch{setError("Could not load support. Please try again.")}finally{setLoading(false)}})()},[]);
 async function openTicket(t:Ticket){setSelected(t);setError("");const {data,error}=await supabase.from("support_messages").select("id,sender_type,message,created_at").eq("ticket_id",t.id).order("created_at",{ascending:true});if(error){setError("Could not load this conversation.");return}setMessages((data??[]) as Message[])}
 async function askAssistant(e:FormEvent){e.preventDefault();if(!assistantQuestion.trim())return;setAssistantBusy(true);setAssistantAnswer("");setAssistantEscalate(false);setError("");try{
  const {data,error}=await supabase.functions.invoke("support-assistant",{body:{message:assistantQuestion.trim(),category}});if(error)throw error;
  if(data?.action==="answer")setAssistantAnswer(String(data.answer||""));else{setAssistantEscalate(true);setAssistantAnswer(String(data?.reason||"This request needs review by CarFix Support."));}
 }catch{setAssistantEscalate(true);setAssistantAnswer("The assistant could not safely answer this request. Please create a support ticket below.")}finally{setAssistantBusy(false)}}
 async function createTicket(e:FormEvent){e.preventDefault();if(!userId||subject.trim().length<3||!firstMessage.trim())return;setSaving(true);setError("");try{
  const {data:t,error:te}=await supabase.from("support_tickets").insert({user_id:userId,assessment_id:assessmentId||null,category,subject:subject.trim(),status:"open"}).select("id,ticket_number,category,subject,status,assessment_id,created_at,updated_at").single();if(te)throw te;
  const {error:me}=await supabase.from("support_messages").insert({ticket_id:t.id,sender_type:"customer",sender_user_id:userId,message:firstMessage.trim()});if(me)throw me;
  setSubject("");setFirstMessage("");setAssessmentId("");await loadTickets(userId);await openTicket(t as Ticket);
 }catch{setError("We could not create your support request. Please try again.")}finally{setSaving(false)}}
 async function sendReply(e:FormEvent){e.preventDefault();if(!selected||!reply.trim()||selected.status==="resolved")return;setSaving(true);setError("");try{
  const {error}=await supabase.from("support_messages").insert({ticket_id:selected.id,sender_type:"customer",sender_user_id:userId,message:reply.trim()});if(error)throw error;setReply("");await openTicket(selected);
 }catch{setError("Your message could not be sent. Please try again.")}finally{setSaving(false)}}
 if(loading)return <main className="dashboard-page"><section className="section"><div className="container"><p>Loading support…</p></div></section></main>;
 return <main className="dashboard-page">
  <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><a className="brand" href="/"><span>Car</span>Fix.</a><a className="btn" href="/dashboard">← Dashboard</a></div></header>
  <section className="section"><div className="container">
   <div className="dashboard-list-heading"><div><div className="home-kicker">CUSTOMER SUPPORT</div><h1>Support & grievances</h1><p className="muted">Ask for help and receive replies securely inside your CarFix account.</p></div></div>
   {error&&<div className="card" style={{marginBottom:18}}><p>{error}</p></div>}
   <form className="card" onSubmit={askAssistant} style={{marginBottom:20}}><div className="home-kicker">CARFIX ASSISTANT</div><h2>Quick help</h2><p className="muted">Ask a simple question first. Payment actions, refunds, privacy/data requests, grievances and account-specific problems are sent to human support.</p><label>Your question<textarea rows={3} maxLength={2000} required value={assistantQuestion} onChange={e=>setAssistantQuestion(e.target.value)} placeholder="Example: What does the AI assessment cover?"/></label><button className="btn primary" disabled={assistantBusy}>{assistantBusy?"Checking…":"Ask CarFix Assistant"}</button>{assistantAnswer&&<div style={{marginTop:14,padding:14,border:"1px solid rgba(128,128,128,.25)",borderRadius:12}}><strong>{assistantEscalate?"Human support needed":"CarFix Assistant"}</strong><p style={{whiteSpace:"pre-wrap"}}>{assistantAnswer}</p>{assistantEscalate&&<button type="button" className="btn" onClick={()=>{setSubject(assistantQuestion.slice(0,160));setFirstMessage(assistantQuestion)}}>Use this question for a ticket</button>}</div>}</form>
   <div style={{display:"grid",gridTemplateColumns:"minmax(280px,1fr) minmax(320px,1.4fr)",gap:20,alignItems:"start"}}>
    <div>
     <form className="card" onSubmit={createTicket}><h2>New support request</h2>
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>Related assessment (optional)<select value={assessmentId} onChange={e=>setAssessmentId(e.target.value)}><option value="">Not related to an assessment</option>{assessments.map(a=><option key={a.id} value={a.id}>{a.city||"Assessment"} · {new Date(a.created_at).toLocaleDateString("en-IN")}</option>)}</select></label>
      <label>Subject<input maxLength={160} minLength={3} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Briefly describe the issue"/></label>
      <label>Message<textarea maxLength={5000} required rows={5} value={firstMessage} onChange={e=>setFirstMessage(e.target.value)} placeholder="Tell us how we can help."/></label>
      <button className="btn primary" disabled={saving}>{saving?"Sending…":"Create support request"}</button>
     </form>
     <div className="card" style={{marginTop:18}}><h2>Your requests</h2>{!tickets.length?<p className="muted">No support requests yet.</p>:tickets.map(t=><button key={t.id} className="btn" style={{display:"block",width:"100%",textAlign:"left",marginTop:10}} onClick={()=>openTicket(t)}><strong>{t.ticket_number}</strong><br/><span>{t.subject}</span><br/><small>{labels[t.category]||t.category} · {t.status.replaceAll("_"," ")}</small></button>)}</div>
    </div>
    <div className="card">{!selected?<><h2>Conversation</h2><p className="muted">Select one of your support requests to view replies.</p></>:<>
     <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><div className="home-kicker">{selected.ticket_number}</div><h2>{selected.subject}</h2></div><span className="home-pill">{selected.status.replaceAll("_"," ")}</span></div>
     <p className="muted">{labels[selected.category]||selected.category}</p>
     <div style={{display:"grid",gap:12,margin:"22px 0"}}>{messages.map(m=><div key={m.id} style={{padding:14,border:"1px solid rgba(128,128,128,.25)",borderRadius:12}}><strong>{m.sender_type==="customer"?"You":m.sender_type==="admin"?"CarFix Support":"CarFix Assistant"}</strong><p style={{whiteSpace:"pre-wrap"}}>{m.message}</p><small className="muted">{new Date(m.created_at).toLocaleString("en-IN")}</small></div>)}</div>
     {selected.status==="resolved"?<p className="muted">This request has been resolved. Create a new request if you need more help.</p>:<form onSubmit={sendReply}><label>Reply<textarea maxLength={5000} required rows={4} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write your reply…"/></label><button className="btn primary" disabled={saving}>{saving?"Sending…":"Send reply"}</button></form>}
    </>}</div>
   </div>
  </div></section>
 </main>
}
