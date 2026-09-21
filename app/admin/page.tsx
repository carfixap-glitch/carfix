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
      setRows(base.map((x: any) => ({ ...x, profile: pm.get(x.user_id) ?? null, vehicle: vm.get(x.vehicle_id) ?? null, severity: am.get(x.id)?.severity ?? null, minCost: em.get(x.id)?.estimated_min_cost ?? null, maxCost: em.get(x.id)?.estimated_max_cost ?? null })));
      setLoading(false);
    }
    load().catch((e) => { setError(e instanceof Error ? e.message : "Could not load admin dashboard"); setLoading(false); });
  }, []);

  async function logout() { await supabase.auth.signOut(); window.location.href = "/"; }

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
    <header className="nav">
      <div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
        <div className="brand"><span>Car</span>Fix <small style={{fontSize:13,marginLeft:8}}>Admin</small></div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <a className="btn" href="/admin/customers">👥 Customers</a>
          <button className="btn" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>
    <section className="section"><div className="container">
      <p className="muted">Administration</p><h1>CarFix Admin Dashboard</h1><p className="muted">Manage customers and their vehicle assessments.</p>
      {error && <div className="card" style={{marginTop:20}}><p>{error}</p></div>}
      <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginTop:24}}>
        <div className="card"><p className="muted">Total assessments</p><h2>{rows.length}</h2></div>
        <div className="card"><p className="muted">Completed</p><h2>{completed}</h2></div>
        <div className="card"><p className="muted">Pending / processing</p><h2>{pending}</h2></div>
      </div>
      <div className="card" style={{marginTop:24}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><h2>Assessment management</h2><input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="Search customer, email, phone, vehicle, city" style={{padding:12,borderRadius:8,border:"1px solid #ccc",minWidth:280}} /></div>
        <div style={{display:"grid",gap:12,marginTop:18}}>{visible.map((r)=><div key={r.id} className="card" style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{r.profile?.full_name || "Customer"}</strong><span className="muted">{new Date(r.created_at).toLocaleString("en-IN")}</span></div>
          <p style={{marginTop:6}}><strong>Email:</strong> {r.profile?.email || "No email"}</p>
          <p style={{marginTop:4}}><strong>Phone:</strong> {r.profile?.phone || "No phone"} · {r.vehicle?.make || "Vehicle"} {r.vehicle?.model || ""} {r.vehicle?.year ? `(${r.vehicle.year})` : ""}</p>
          <div style={{marginTop:8,padding:10,borderRadius:8,background:"#f8fafc"}}>
            <strong>📍 Customer location</strong>
            <p className="muted" style={{marginTop:4}}>{[r.address,r.city,r.state].filter(Boolean).join(", ")}{r.pincode ? ` - ${r.pincode}` : ""}{r.country ? `, ${r.country}` : ""}</p>
          </div>
          {r.severity && <p style={{marginTop:6}}><strong>AI severity:</strong> {r.severity}</p>}
          {r.minCost != null && r.maxCost != null && <p><strong>Estimate:</strong> ₹{Number(r.minCost).toLocaleString("en-IN")} – ₹{Number(r.maxCost).toLocaleString("en-IN")}</p>}
          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:10,flexWrap:"wrap"}}><select value={r.status || "pending"} onChange={(e)=>updateStatus(r.id,e.target.value)}><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><a className="btn primary" href={`/assessments/${r.id}`}>View assessment</a></div>
        </div>)}{!visible.length && <p className="muted">No matching assessments.</p>}</div>
      </div>
    </div></section>
  </main>;
}
