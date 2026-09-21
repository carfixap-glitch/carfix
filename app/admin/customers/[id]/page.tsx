"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useParams } from "next/navigation";

type Customer={id:string;full_name:string|null;phone:string|null;email:string|null;created_at:string};
type Vehicle={id:string;make:string|null;model:string|null;year:number|null;registration_number:string|null};
type Assessment={id:string;city:string|null;address:string|null;state:string|null;pincode:string|null;country:string|null;status:string|null;created_at:string;vehicle_id:string|null};
type Manual={id:string;damage_description:string|null;estimated_min_cost:number|null;estimated_max_cost:number|null;shop_name:string|null;created_at:string};

export default function CustomerDetailPage(){
  const supabase=createClient();
  const routeParams=useParams<{id:string}>();
  const customerId=typeof routeParams?.id==="string"?routeParams.id:"";
  const [customer,setCustomer]=useState<Customer|null>(null);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [assessments,setAssessments]=useState<Assessment[]>([]);
  const [manuals,setManuals]=useState<Manual[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{(async()=>{
    if(!customerId){setError("Customer ID is missing from the URL");setLoading(false);return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}
    const {data:admin, error:adminError}=await supabase.from("profiles").select("role").eq("id",user.id).single();
    if(adminError||admin?.role!=="admin"){window.location.href="/dashboard";return;}

    const [{data:c,error:ce},{data:v,error:ve},{data:a,error:ae},{data:m,error:me}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,phone,email,created_at").eq("id",customerId).eq("role","customer").single(),
      supabase.from("vehicles").select("id,make,model,year,registration_number").eq("user_id",customerId).order("created_at",{ascending:false}),
      supabase.from("assessments").select("id,city,address,state,pincode,country,status,created_at,vehicle_id").eq("user_id",customerId).order("created_at",{ascending:false}),
      supabase.from("manual_assessments").select("id,damage_description,estimated_min_cost,estimated_max_cost,shop_name,created_at").eq("customer_id",customerId).order("created_at",{ascending:false})
    ]);

    if(ce)throw new Error(ce.message);
    if(ve)throw new Error(ve.message);
    if(ae)throw new Error(ae.message);
    if(me)throw new Error(me.message);
    if(!c)throw new Error("Customer not found");

    setCustomer(c);setVehicles(v??[]);setAssessments(a??[]);setManuals(m??[]);setLoading(false);
  })().catch(e=>{setError(e instanceof Error?e.message:"Could not load customer");setLoading(false);});},[customerId]);

  async function logout(){await supabase.auth.signOut();window.location.href="/";}

  function vehicleName(vehicleId:string|null){
    const v=vehicles.find(x=>x.id===vehicleId);
    if(!v)return "Vehicle";
    return ((v.make||"Vehicle")+" "+(v.model||"")).trim()+(v.year?" ("+v.year+")":"");
  }

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
        <h2>Customer details</h2>
        <p style={{marginTop:10}}><strong>Phone:</strong> {customer.phone||"No phone"}</p>
        <p style={{marginTop:6}}><strong>Email:</strong> {customer.email||"No email"}</p>
        <p style={{marginTop:6}}><strong>Joined:</strong> {new Date(customer.created_at).toLocaleDateString("en-IN")}</p>
      </div>

      <div className="card" style={{marginTop:24}}>
        <h2>🚗 Saved vehicles</h2>
        <div style={{display:"grid",gap:10,marginTop:14}}>
          {vehicles.map(v=><div key={v.id} className="card" style={{padding:14}}>
            <strong>{v.make||"Vehicle"} {v.model||""}</strong>{v.year&&<span className="muted"> · {v.year}</span>}
            {v.registration_number&&<p className="muted" style={{marginTop:5}}>Registration: {v.registration_number}</p>}
          </div>)}
          {!vehicles.length&&<p className="muted">No vehicles saved for this customer.</p>}
        </div>
      </div>

      <div className="card" style={{marginTop:24}}>
        <h2>📋 Previous assessments</h2>
        <div style={{display:"grid",gap:12,marginTop:14}}>
          {assessments.map(a=><div key={a.id} className="card" style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <strong>{vehicleName(a.vehicle_id)}</strong><span className="muted">{new Date(a.created_at).toLocaleString("en-IN")}</span>
            </div>
            <p style={{marginTop:7}}><strong>Status:</strong> {a.status||"—"}</p>
            <p style={{marginTop:5}}><strong>Location:</strong> {[a.address,a.city,a.state,a.pincode,a.country].filter(Boolean).join(", ")||"Location not available"}</p>
            <a className="btn" style={{marginTop:10}} href={"/assessments/"+a.id}>View Assessment →</a>
          </div>)}
          {!assessments.length&&<p className="muted">No previous assessments for this customer.</p>}
        </div>
      </div>

      <div className="card" style={{marginTop:24}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div><p className="muted">Manual assessment</p><h2>📝 Manual Assessments</h2></div>
          <a className="btn primary" href={"/admin/customers/"+customer.id+"/manual-assessment"}>➕ Create Manual Assessment</a>
        </div>
        <div style={{display:"grid",gap:12,marginTop:18}}>
          {manuals.map(m=><div key={m.id} className="card" style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <strong>{new Date(m.created_at).toLocaleString("en-IN")}</strong>{m.shop_name&&<span>{m.shop_name}</span>}
            </div>
            {m.damage_description&&<p style={{marginTop:8}}><strong>Damage:</strong> {m.damage_description}</p>}
            {(m.estimated_min_cost!=null||m.estimated_max_cost!=null)&&<p style={{marginTop:6}}><strong>Estimated cost:</strong> ₹{m.estimated_min_cost!=null?Number(m.estimated_min_cost).toLocaleString("en-IN"):"—"} – ₹{m.estimated_max_cost!=null?Number(m.estimated_max_cost).toLocaleString("en-IN"):"—"}</p>}
            <a className="btn" style={{marginTop:10}} href={"/admin/customers/"+customer.id+"/manual-assessment/"+m.id}>📄 View / PDF</a>
          </div>)}
          {!manuals.length&&<p className="muted">No manual assessments for this customer yet.</p>}
        </div>
      </div>
    </div></section>
  </main>;
}
