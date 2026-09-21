"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Customer = { id:string; full_name:string|null; phone:string|null; email:string|null };
type Vehicle = { id:string; make:string|null; model:string|null; year:number|null };

export default function ManualAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient();
  const [customer,setCustomer]=useState<Customer|null>(null); const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [vehicleId,setVehicleId]=useState(""); const [damage,setDamage]=useState(""); const [parts,setParts]=useState("");
  const [recommendations,setRecommendations]=useState(""); const [repair,setRepair]=useState(""); const [minCost,setMinCost]=useState(""); const [maxCost,setMaxCost]=useState("");
  const [time,setTime]=useState(""); const [shopName,setShopName]=useState(""); const [shopPhone,setShopPhone]=useState(""); const [shopAddress,setShopAddress]=useState(""); const [services,setServices]=useState(""); const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");

  useEffect(()=>{(async()=>{ const {id}=await params; const {data:{user}}=await supabase.auth.getUser(); if(!user){window.location.href="/login";return;}
    const {data:admin}=await supabase.from("profiles").select("role").eq("id",user.id).single(); if(admin?.role!=="admin"){window.location.href="/dashboard";return;}
    const [{data:c},{data:v}]=await Promise.all([supabase.from("profiles").select("id,full_name,phone,email").eq("id",id).eq("role","customer").single(),supabase.from("vehicles").select("id,make,model,year").eq("user_id",id).order("created_at",{ascending:false})]);
    if(!c){setError("Customer not found");return;} setCustomer(c);setVehicles(v??[]);if(v?.[0])setVehicleId(v[0].id);
  })().catch(e=>setError(e.message));},[]);

  async function save(){ setSaving(true);setError(""); const {data:{user}}=await supabase.auth.getUser(); if(!user){setError("Admin session expired");setSaving(false);return;} if(!customer?.id){setError("Customer ID is missing. Please reopen this assessment from Assessment Management.");setSaving(false);return;}
    const {data,error}=await supabase.from("manual_assessments").insert({customer_id:customer.id,vehicle_id:vehicleId||null,damage_description:damage,damaged_parts:parts.split("\n").map(x=>x.trim()).filter(Boolean),recommendations,repair_or_replacement:repair,estimated_min_cost:minCost?Number(minCost):null,estimated_max_cost:maxCost?Number(maxCost):null,estimated_time:time,shop_name:shopName,shop_phone:shopPhone,shop_address:shopAddress,shop_services:services.split(",").map(x=>x.trim()).filter(Boolean),additional_notes:notes,created_by:user.id}).select("id").single();
    if(error){setError(error.message);setSaving(false);return;} window.location.href=`/admin/customers/${customer.id}/manual-assessment/${data.id}`;
  }
  if(error&&!customer)return <main className="section"><div className="container"><div className="card"><p>{error}</p></div></div></main>; if(!customer)return <main className="section"><div className="container">Loading...</div></main>;
  return <main><header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="brand"><span>Car</span>Fix <small style={{fontSize:13,marginLeft:8}}>Admin</small></div><a className="btn" href="/admin">← Assessment Management</a></div></header><section className="section"><div className="container"><p className="muted">Manual assessment</p><h1>Create manual assessment</h1><div className="card" style={{marginTop:20}}><strong>{customer.full_name||"Customer"}</strong><p className="muted">{customer.phone||"No phone"} · {customer.email||"No email"}</p></div>{error&&<div className="card" style={{marginTop:16}}><p>{error}</p></div>}
  <div className="card" style={{marginTop:20,display:"grid",gap:16}}><h2>Vehicle</h2><select value={vehicleId} onChange={e=>setVehicleId(e.target.value)}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make||"Vehicle"} {v.model||""}{v.year?` (${v.year})`:""}</option>)}</select><h2>Damage & repair</h2><textarea placeholder="Describe the damage" value={damage} onChange={e=>setDamage(e.target.value)} rows={5}/><textarea placeholder="Damaged parts — one per line" value={parts} onChange={e=>setParts(e.target.value)} rows={5}/><textarea placeholder="Repair recommendations" value={recommendations} onChange={e=>setRecommendations(e.target.value)} rows={4}/><textarea placeholder="Repair or replacement details" value={repair} onChange={e=>setRepair(e.target.value)} rows={4}/><div className="grid" style={{gridTemplateColumns:"repeat(2,1fr)",gap:12}}><input type="number" placeholder="Minimum cost (₹)" value={minCost} onChange={e=>setMinCost(e.target.value)}/><input type="number" placeholder="Maximum cost (₹)" value={maxCost} onChange={e=>setMaxCost(e.target.value)}/></div><input placeholder="Estimated repair time (e.g. 3–5 days)" value={time} onChange={e=>setTime(e.target.value)}/><h2>Shop / garage</h2><input placeholder="Shop name" value={shopName} onChange={e=>setShopName(e.target.value)}/><input placeholder="Shop phone" value={shopPhone} onChange={e=>setShopPhone(e.target.value)}/><textarea placeholder="Shop address" value={shopAddress} onChange={e=>setShopAddress(e.target.value)} rows={3}/><input placeholder="Services (comma separated)" value={services} onChange={e=>setServices(e.target.value)}/><textarea placeholder="Additional notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={4}/><button className="btn primary" onClick={save} disabled={saving}>{saving?"Saving...":"Save & continue to PDF"}</button></div></div></section></main>;
}
