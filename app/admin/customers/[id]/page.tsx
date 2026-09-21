"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Customer={id:string;full_name:string|null;phone:string|null;email:string|null;created_at:string};
type Manual={id:string;damage_description:string|null;estimated_min_cost:number|null;estimated_max_cost:number|null;shop_name:string|null;created_at:string};

export default function CustomerDetailPage({params}:{params:{id:string}}){
  const supabase=createClient();
  const [customer,setCustomer]=useState<Customer|null>(null);
  const [manuals,setManuals]=useState<Manual[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}
    const {data:admin}=await supabase.from("profiles").select("role").eq("id",user.id).single();
    if(admin?.role!=="admin"){window.location.href="/dashboard";return;}

    const [{data:c,error:ce},{data:m,error:me}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,phone,email,created_at").eq("id",params.id).eq("role","customer").single(),
      supabase.from("manual_assessments").select("id,damage_description,estimated_min_cost,estimated_max_cost,shop_name,created_at").eq("customer_id",params.id).order("created_at",{ascending:false})
    ]);
    if(ce)throw new Error(ce.message);
    if(me)throw new Error(me.message);
    setCustomer(c);setManuals(m??[]);setLoading(false);
  })().catch(e=>{setError(e instanceof Error?e.message:"Could not load customer");setLoading(false);});},[]);

  async function logout(){await supabase.auth.signOut();window.location.href="/";}

  if(loading)return <main className="section"><div className="container">Loading customer...</div></main>;
  if(error||!customer)return <main className="section"><div className="container"><div className="card"><p>{error||"Customer not found"}</p></div></div></main>;

  return <main>
    <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
      <div className="brand"><span>Car</span>Fix <small style={{fontSize:13,marginLeft:8}}>Admin</small></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <a className="btn" href="/admin/customers">← Customers</a>
        <button className="btn" onClick={logout}>Sign out</button>
      </div>
    </div></header>

    <section className="section"><div className="container">
      <p className="muted">Customer profile</p><h1>{customer.full_name||"Customer"}</h1>
      <div className="card" style={{marginTop:20}}>
        <p><strong>Phone:</strong> {customer.phone||"No phone"}</p>
        <p style={{marginTop:6}}><strong>Email:</strong> {customer.email||"No email"}</p>
        <p style={{marginTop:6}}><strong>Joined:</strong> {new Date(customer.created_at).toLocaleDateString("en-IN")}</p>
      </div>

      <div className="card" style={{marginTop:24}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div><p className="muted">Manual assessment</p><h2>📝 Manual Assessments</h2></div>
          <a className="btn primary" href={`/admin/customers/${customer.id}/manual-assessment`}>➕ Create Manual Assessment</a>
        </div>

        <div style={{display:"grid",gap:12,marginTop:18}}>
          {manuals.map(m=><div key={m.id} className="card" style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <strong>{new Date(m.created_at).toLocaleString("en-IN")}</strong>
              {m.shop_name&&<span>{m.shop_name}</span>}
            </div>
            {m.damage_description&&<p style={{marginTop:8}}><strong>Damage:</strong> {m.damage_description}</p>}
            {(m.estimated_min_cost!=null||m.estimated_max_cost!=null)&&<p style={{marginTop:6}}><strong>Estimated cost:</strong> ₹{m.estimated_min_cost!=null?Number(m.estimated_min_cost).toLocaleString("en-IN"):"—"} – ₹{m.estimated_max_cost!=null?Number(m.estimated_max_cost).toLocaleString("en-IN"):"—"}</p>}
            <a className="btn" style={{marginTop:10}} href={`/admin/customers/${customer.id}/manual-assessment/${m.id}`}>📄 View / PDF</a>
          </div>)}
          {!manuals.length&&<p className="muted">No manual assessments for this customer yet.</p>}
        </div>
      </div>
    </div></section>
  </main>;
}
