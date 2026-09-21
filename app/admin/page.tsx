"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Row = {
  id: string;
  city: string | null;
  address: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  status: string | null;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null; phone: string | null; email: string | null } | null;
  vehicle?: { make: string | null; model: string | null; year: number | null } | null;
  severity?: string | null;
  minCost?: number | null;
  maxCost?: number | null;
};

export default function AdminPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [manualCount, setManualCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: adminCheck, error: adminError } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (adminError || adminCheck?.role !== "admin") {
        window.location.href = "/dashboard";
        return;
      }

      const { data: assessments, error: aError } = await supabase
        .from("assessments")
        .select("id, user_id, vehicle_id, city, address, state, pincode, country, status, created_at")
        .order("created_at", { ascending: false });
      if (aError) throw new Error(aError.message);

      const { count: manualTotal, error: mError } = await supabase
        .from("manual_assessments")
        .select("id", { count: "exact", head: true });
      if (mError) throw new Error(mError.message);

      const base = assessments ?? [];
      const userIds = [...new Set(base.map((x: any) => x.user_id).filter(Boolean))];
      const vehicleIds = [...new Set(base.map((x: any) => x.vehicle_id).filter(Boolean))];
      const ids = base.map((x: any) => x.id);

      const [{ data: profiles }, { data: vehicles }, { data: analyses }, { data: estimates }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, full_name, phone, email").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        vehicleIds.length ? supabase.from("vehicles").select("id, make, model, year").in("id", vehicleIds) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("damage_analysis").select("assessment_id, severity").in("assessment_id", ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from("repair_estimates").select("assessment_id, estimated_min_cost, estimated_max_cost").in("assessment_id", ids) : Promise.resolve({ data: [] as any[] }),
      ]);

      const pm = new Map((profiles ?? []).map((x: any) => [x.id, x]));
      const vm = new Map((vehicles ?? []).map((x: any) => [x.id, x]));
      const am = new Map((analyses ?? []).map((x: any) => [x.assessment_id, x]));
      const em = new Map((estimates ?? []).map((x: any) => [x.assessment_id, x]));

      setRows(base.map((x: any) => ({
        ...x,
        profile: pm.get(x.user_id) ?? null,
        vehicle: vm.get(x.vehicle_id) ?? null,
        severity: am.get(x.id)?.severity ?? null,
        minCost: em.get(x.id)?.estimated_min_cost ?? null,
        maxCost: em.get(x.id)?.estimated_max_cost ?? null
      })));
      setManualCount(manualTotal ?? 0);
      setLoading(false);
    }

    load().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load admin dashboard");
      setLoading(false);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("assessments").update({ status }).eq("id", id);
    if (error) { setError(error.message); return; }
    setRows((current) => current.map((r) => r.id === id ? { ...r, status } : r));
  }

  if (loading) return <main className="section"><div className="container">Loading admin dashboard...</div></main>;

  const visible = rows.filter((r) => `${r.profile?.full_name ?? ""} ${r.profile?.email ?? ""} ${r.profile?.phone ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""} ${r.city ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const completed = rows.filter((r) => r.status === "completed").length;
  const pending = rows.filter((r) => r.status === "pending" || r.status === "processing").length;

  return <main>
    <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div className="brand"><span>Car</span>Fix. <small style={{fontSize:11,color:"#667085"}}>ADMIN</small></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><a className="btn" href="/admin/customers">Customers</a><a className="btn" href="/admin/manual-assessments">Manual assessments</a><button className="btn" onClick={logout}>Sign out</button></div></div></header>
    <section className="section"><div className="container">
      <div className="admin-hero"><div style={{position:"relative",zIndex:1}}><div className="home-kicker">CARFIX CONTROL CENTER</div><h1>Everything in view.</h1><p>Monitor customer assessments, AI reports and manual workshop assessments from one workspace.</p></div></div>
      {error&&<div className="card" style={{marginTop:20}}><p>{error}</p></div>}
      <div className="grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginTop:22}}><div className="app-stat"><span>Total assessments</span><strong>{rows.length}</strong></div><div className="app-stat"><span>Completed</span><strong>{completed}</strong></div><div className="app-stat"><span>Pending / processing</span><strong>{pending}</strong></div><a className="app-stat" href="/admin/manual-assessments" style={{textDecoration:"none",color:"inherit"}}><span>Manual assessments</span><strong>{manualCount}</strong></a></div>
      <div className="card" style={{marginTop:28,padding:25}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:20,flexWrap:"wrap"}}><div><div className="home-kicker">ASSESSMENT MANAGEMENT</div><h2 style={{fontSize:28,letterSpacing:-1,margin:"8px 0 0"}}>Customer assessments</h2></div><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search customer, vehicle or city" style={{padding:12,borderRadius:10,minWidth:280}}/></div>
      <div style={{display:"grid",gap:12,marginTop:20}}>{visible.map(r=><div key={r.id} className="assessment-card">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{r.profile?.full_name||"Customer"}</strong><p className="muted" style={{margin:"4px 0 0",fontSize:11}}>{r.profile?.phone||"No phone"} · {r.profile?.email||"No email"}</p></div><span className="home-pill">{r.status||"pending"}</span></div>
        <div className="admin-assessment-meta"><div><small>CUSTOMER VEHICLE</small><strong>{r.vehicle?.make||"Vehicle"} {r.vehicle?.model||""}</strong></div><div><small>LOCATION</small><strong>{r.city||"Not provided"}</strong></div><div><small>AI SEVERITY</small><strong>{r.severity||"—"}</strong></div><div><small>ESTIMATE</small><strong>{r.minCost!=null&&r.maxCost!=null?`₹${Number(r.minCost).toLocaleString("en-IN")} – ₹${Number(r.maxCost).toLocaleString("en-IN")}`:"—"}</strong></div></div>
        <div className="admin-location">📍 {[r.address,r.city,r.state].filter(Boolean).join(", ")}{r.pincode?` — ${r.pincode}`:""}{r.country?`, ${r.country}`:""}</div>
        <div style={{display:"flex",gap:9,alignItems:"center",marginTop:14,flexWrap:"wrap"}}><select value={r.status||"pending"} onChange={e=>updateStatus(r.id,e.target.value)} style={{padding:9}}><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><a className="btn primary" href={`/assessments/${r.id}`}>View assessment →</a><a className="btn" href={`/admin/customers/${r.user_id}/manual-assessment`}>Create manual assessment</a></div>
      </div>)}{!visible.length&&<p className="muted" style={{padding:25,textAlign:"center"}}>No matching assessments.</p>}</div></div>
    </div></section>
  </main>;
  </main>;
}