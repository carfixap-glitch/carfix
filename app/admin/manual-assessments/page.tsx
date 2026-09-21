"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type ManualRow = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  damage_description: string | null;
  estimated_min_cost: number | null;
  estimated_max_cost: number | null;
  shop_name: string | null;
  created_at: string;
  customer?: { full_name: string | null; phone: string | null; email: string | null } | null;
  vehicle?: { make: string | null; model: string | null; year: number | null } | null;
};

export default function ManualAssessmentsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      const { data: manuals, error: mError } = await supabase
        .from("manual_assessments")
        .select("id, customer_id, vehicle_id, damage_description, estimated_min_cost, estimated_max_cost, shop_name, created_at")
        .order("created_at", { ascending: false });
      if (mError) throw new Error(mError.message);

      const base = manuals ?? [];
      const customerIds = [...new Set(base.map((x: any) => x.customer_id).filter(Boolean))];
      const vehicleIds = [...new Set(base.map((x: any) => x.vehicle_id).filter(Boolean))];

      const [{ data: customers }, { data: vehicles }] = await Promise.all([
        customerIds.length ? supabase.from("profiles").select("id, full_name, phone, email").in("id", customerIds) : Promise.resolve({ data: [] as any[] }),
        vehicleIds.length ? supabase.from("vehicles").select("id, make, model, year").in("id", vehicleIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const cm = new Map((customers ?? []).map((x: any) => [x.id, x]));
      const vm = new Map((vehicles ?? []).map((x: any) => [x.id, x]));

      setRows(base.map((x: any) => ({
        ...x,
        customer: cm.get(x.customer_id) ?? null,
        vehicle: vm.get(x.vehicle_id) ?? null
      })));
      setLoading(false);
    }

    load().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load manual assessments");
      setLoading(false);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <main className="section"><div className="container">Loading manual assessments...</div></main>;

  return <main>
    <header className="nav">
      <div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
        <div className="brand"><span>Car</span>Fix <small style={{fontSize:13,marginLeft:8}}>Admin</small></div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <a className="btn" href="/admin">← Admin Dashboard</a>
          <button className="btn" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>

    <section className="section"><div className="container">
      <p className="muted">Administration</p>
      <h1>📝 Manual Assessments</h1>
      <p className="muted">All manual assessments created for customers.</p>

      {error && <div className="card" style={{marginTop:20}}><p>{error}</p></div>}

      <div className="card" style={{marginTop:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <h2>Total manual assessments: {rows.length}</h2>
        </div>
        <div style={{display:"grid",gap:12,marginTop:18}}>
          {rows.map((r) => <div key={r.id} className="card" style={{padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <strong>{r.customer?.full_name || "Customer"}</strong>
              <span className="muted">{new Date(r.created_at).toLocaleString("en-IN")}</span>
            </div>
            <p style={{marginTop:6}}><strong>Email:</strong> {r.customer?.email || "No email"}</p>
            <p style={{marginTop:4}}><strong>Phone:</strong> {r.customer?.phone || "No phone"}</p>
            <p style={{marginTop:4}}><strong>Vehicle:</strong> {r.vehicle?.make || "Vehicle"} {r.vehicle?.model || ""} {r.vehicle?.year ? `(${r.vehicle.year})` : ""}</p>
            {r.damage_description && <p style={{marginTop:4}}><strong>Damage:</strong> {r.damage_description}</p>}
            {(r.estimated_min_cost != null || r.estimated_max_cost != null) && <p style={{marginTop:4}}><strong>Cost:</strong> ₹{r.estimated_min_cost != null ? Number(r.estimated_min_cost).toLocaleString("en-IN") : "—"} – ₹{r.estimated_max_cost != null ? Number(r.estimated_max_cost).toLocaleString("en-IN") : "—"}</p>}
            {r.shop_name && <p style={{marginTop:4}}><strong>Shop:</strong> {r.shop_name}</p>}
            <a className="btn primary" style={{marginTop:10}} href={`/admin/customers/${r.customer_id}/manual-assessment/${r.id}`}>View / PDF</a>
          </div>)}
          {!rows.length && <p className="muted">No manual assessments yet.</p>}
        </div>
      </div>
    </div></section>
  </main>;
}
