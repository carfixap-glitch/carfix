"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type Ticket={id:string;ticket_number:string;user_id:string;assessment_id:string|null;category:string;subject:string;status:string;created_at:string;updated_at:string;resolved_at:string|null;customer?:{full_name:string|null;phone:string|null;email:string|null}|null};
type Message={id:string;sender_type:string;sender_user_id:string|null;message:string;created_at:string};
const categoryLabels:Record<string,string>={assessment_issue:"Assessment issue",payment_issue:"Payment issue",ai_result_question:"AI result question",account_issue:"Account issue",privacy_data_request:"Privacy / data request",technical_problem:"Technical problem",other_grievance:"Other grievance"};
const statuses=["open","in_review","waiting_for_customer","resolved"] as const;

export default function AdminSupportPage(){
 const supabase=useMemo(()=>createClient(),[]);
 const [adminId,setAdminId]=useState(""),[tickets,setTickets]=useState<Ticket[]>([]),[selected,setSelected]=useState<Ticket|null>(null),[messages,setMessages]=useState<Message[]>([]);
 const [filter,setFilter]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[reply,setReply]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");

 async function loadTickets(){
  const {data,error}=await supabase.from("support_tickets").select("id,ticket_number,user_id,assessment_id,category,subject,status,created_at,updated_at,resolved_at").order("created_at",{ascending:false});if(error)throw error;
  const base=(data??[]) as Ticket[],userIds=[...new Set(base.map(t=>t.user_id))];
  const {data:profiles,error:pe}=userIds.length?await supabase.from("profiles").select("id,full_name,phone,email").in("id",userIds):{data:[],error:null};if(pe)throw pe;
  const pm=new Map((profiles??[]).map((p:any)=>[p.id,p]));
  const enriched=base.map(t=>({...t,customer:pm.get(t.user_id)??null}));setTickets(enriched);
  if(selected){const fresh=enriched.find(t=>t.id===selected.id);if(fresh)setSelected(fresh)}
 }
 async function loadMessages(ticket:Ticket){setSelected(ticket);setError("");const {data,error}=await supabase.from("support_messages").select("id,sender_type,sender_user_id,message,created_at").eq("ticket_id",ticket.id).order("created_at",{ascending:true});if(error){setError("Could not load this conversation.");return}setMessages((data??[]) as Message[])}
 useEffect(()=>{(async()=>{try{const {data:{user}}=await supabase.auth.getUser();if(!user)return;setAdminId(user.id);await loadTickets()}catch{setError("Could not load support tickets.")}finally{setLoading(false)}})()},[]);
 async function changeStatus(status:string){if(!selected)return;setSaving(true);setError("");try{const patch={status,updated_at:new Date().toISOString(),resolved_at:status==="resolved"?new Date().toISOString():null};const {error}=await supabase.from("support_tickets").update(patch).eq("id",selected.id);if(error)throw error;const next={...selected,...patch};setSelected(next);setTickets(current=>current.map(t=>t.id===next.id?next:t))}catch{setError("Could not update ticket status.")}finally{setSaving(false)}}
 async function sendReply(e:FormEvent){e.preventDefault();if(!selected||!reply.trim()||selected.status==="resolved")return;setSaving(true);setError("");try{
  const {error:me}=await supabase.from("support_messages").insert({ticket_id:selected.id,sender_type:"admin",sender_user_id:adminId,message:reply.trim()});if(me)throw me;
  const now=new Date().toISOString();const {error:te}=await supabase.from("support_tickets").update({status:"waiting_for_customer",updated_at:now,resolved_at:null}).eq("id",selected.id);if(te)throw te;
  setReply("");const next={...selected,status:"waiting_for_customer",updated_at:now,resolved_at:null};setSelected(next);setTickets(current=>current.map(t=>t.id===next.id?next:t));await loadMessages(next);
 }catch{setError("Your reply could not be sent.")}finally{setSaving(false)}}
 const visible=tickets.filter(t=>(statusFilter==="all"||t.status===statusFilter)&&[t.ticket_number,t.subject,t.customer?.full_name||"",t.customer?.email||"",t.customer?.phone||""].join(" ").toLowerCase().includes(filter.toLowerCase()));
 const openCount=tickets.filter(t=>t.status!=="resolved").length,resolvedCount=tickets.filter(t=>t.status==="resolved").length;
 if(loading)return <main className="section"><div className="container">Loading support dashboard...</div></main>;
 return <main>
  <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><a className="brand" href="/admin"><span>Car</span>Fix. <small style={{fontSize:11,color:"#667085"}}>ADMIN</small></a><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><a className="btn" href="/admin">Assessments</a><a className="btn" href="/admin/payments">Payments</a><a className="btn" href="/admin/customers">Customers</a></div></div></header>
  <section className="section"><div className="container">
   <div className="admin-hero"><div style={{position:"relative",zIndex:1}}><div className="home-kicker">SUPPORT CONTROL CENTER</div><h1>Customer support & grievances.</h1><p>Review customer requests, reply inside their CarFix account and track each ticket through resolution.</p></div></div>
   {error&&<div className="card" style={{marginTop:20}}><p>{error}</p></div>}
   <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginTop:22}}><div className="app-stat"><span>Total tickets</span><strong>{tickets.length}</strong></div><div className="app-stat"><span>Active</span><strong>{openCount}</strong></div><div className="app-stat"><span>Resolved</span><strong>{resolvedCount}</strong></div></div>
   <div style={{display:"grid",gridTemplateColumns:"minmax(300px,1fr) minmax(360px,1.4fr)",gap:20,alignItems:"start",marginTop:24}}>
    <div className="card"><div className="home-kicker">TICKETS</div><div style={{display:"grid",gap:10,marginTop:14}}><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search ticket or customer"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></div>
     <div style={{display:"grid",gap:10,marginTop:16}}>{visible.map(t=><button key={t.id} className="btn" style={{textAlign:"left",padding:14}} onClick={()=>loadMessages(t)}><strong>{t.ticket_number}</strong><br/><span>{t.subject}</span><br/><small>{t.customer?.full_name||t.customer?.email||"Customer"} · {t.status.replaceAll("_"," ")}</small></button>)}{!visible.length&&<p className="muted">No matching support tickets.</p>}</div>
    </div>
    <div className="card">{!selected?<><h2>Conversation</h2><p className="muted">Select a ticket to review the customer request and reply.</p></>:<>
     <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><div className="home-kicker">{selected.ticket_number}</div><h2>{selected.subject}</h2></div><span className="home-pill">{selected.status.replaceAll("_"," ")}</span></div>
     <p className="muted">{categoryLabels[selected.category]||selected.category} · {selected.customer?.full_name||"Customer"} · {selected.customer?.email||selected.customer?.phone||"Account user"}</p>
     {selected.assessment_id&&<p><a className="btn" href={"/assessments/"+selected.assessment_id}>View related assessment →</a></p>}
     <label>Ticket status<select value={selected.status} disabled={saving} onChange={e=>changeStatus(e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
     <div style={{display:"grid",gap:12,margin:"22px 0"}}>{messages.map(m=><div key={m.id} style={{padding:14,border:"1px solid rgba(128,128,128,.25)",borderRadius:12}}><strong>{m.sender_type==="customer"?"Customer":m.sender_type==="admin"?"CarFix Support":"CarFix Assistant"}</strong><p style={{whiteSpace:"pre-wrap"}}>{m.message}</p><small className="muted">{new Date(m.created_at).toLocaleString("en-IN")}</small></div>)}</div>
     {selected.status==="resolved"?<p className="muted">This ticket is resolved. Change its status above if further action is required.</p>:<form onSubmit={sendReply}><label>Reply to customer<textarea rows={5} maxLength={5000} required value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write the support reply…"/></label><button className="btn primary" disabled={saving}>{saving?"Sending…":"Send reply"}</button><p className="muted" style={{fontSize:12}}>Sending a reply changes the ticket to Waiting for Customer.</p></form>}
    </>}</div>
   </div>
  </div></section>
 </main>
}
