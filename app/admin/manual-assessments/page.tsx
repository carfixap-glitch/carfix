"use client";

import { useEffect, useMemo, useState } from "react";
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

      const { data: manuals, error: mError } = await supabase
        .from("manual_assessments")
        .select("id, customer_id, vehicle_id, damage_description, estimated_min_cost, estimated_max_cost, shop_name, created_at")
        .order("created_at", { ascending: false });
      if (mError) throw new Error(mError.message);

      const base = manuals ?? [];
      const customerIds = [...new Set(base.map((x: any) => x.customer_id).filter(Boolean))];
      const vehicleIds = [...new Set(base.map((x: any) => x.vehicle_id).filter(Boolean))];

      const [{ data: customers }, { data: vehicles }] = await Promise.all([
        customerIds.length
          ? supabase.from("profiles").select("id, full_name, phone, email").in("id", customerIds)
          : Promise.resolve({ data: [] as any[] }),
        vehicleIds.length
          ? supabase.from("vehicles").select("id, make, model, year").in("id", vehicleIds)
          : Promise.resolve({ data: [] as any[] }),
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

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.customer?.full_name ?? ""} ${r.customer?.phone ?? ""} ${r.customer?.email ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""} ${r.shop_name ?? ""}`.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  if (loading) {
    return <main className="admin-list-page section"><div className="container">Loading manual assessments...</div></main>;
  }

  return (
    <main className="admin-list-page">
      <header className="nav">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div className="brand"><span>Car</span>Fix <small style={{ fontSize: 11, marginLeft: 8, color: "#667085" }}>ADMIN</small></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/admin">Admin dashboard</a>
            <a className="btn" href="/admin/customers">Customers</a>
            <button className="btn" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <div className="admin-page-hero">
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="home-kicker">CARFIX WORKSHOP REPORTS</div>
              <h1>Manual assessments.</h1>
              <p>Review technician-created assessments, cost ranges and workshop details, then open the print-ready report.</p>
            </div>
          </div>

          {error && <div className="admin-list-card" style={{ marginTop: 18 }}><p>{error}</p></div>}

          <div className="admin-list-card" style={{ marginTop: 18 }}>
            <div className="admin-toolbar">
              <div>
                <div className="home-kicker">WORKSHOP ASSESSMENTS</div>
                <h2 style={{ margin: "7px 0 0", fontSize: 26, letterSpacing: -1 }}>Manual assessment library</h2>
                <p className="muted" style={{ marginTop: 5 }}>{rows.length} report{rows.length === 1 ? "" : "s"}</p>
              </div>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search customer, vehicle or shop"
                aria-label="Search manual assessments"
              />
            </div>

            <div style={{ display: "grid", gap: 11, marginTop: 20 }}>
              {visible.map((r) => (
                <div key={r.id} className="admin-item">
                  <div className="admin-item-top">
                    <div>
                      <strong>{r.customer?.full_name || "Customer"}</strong>
                      <div className="admin-item-meta">
                        {r.customer?.phone || "No phone"} · {r.customer?.email || "No email"}<br />
                        {r.vehicle?.make || "Vehicle"} {r.vehicle?.model || ""}{r.vehicle?.year ? ` · ${r.vehicle.year}` : ""} · {new Date(r.created_at).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <span className="admin-chip">
                      {r.estimated_min_cost != null || r.estimated_max_cost != null
                        ? `₹${r.estimated_min_cost != null ? Number(r.estimated_min_cost).toLocaleString("en-IN") : "—"} – ₹${r.estimated_max_cost != null ? Number(r.estimated_max_cost).toLocaleString("en-IN") : "—"}`
                        : "Estimate pending"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 14 }}>
                    <div><small className="muted">DAMAGE</small><div style={{ marginTop: 4 }}>{r.damage_description || "No description"}</div></div>
                    <div><small className="muted">WORKSHOP</small><div style={{ marginTop: 4 }}>{r.shop_name || "Not provided"}</div></div>
                    <div><small className="muted">REPORT</small><div style={{ marginTop: 4 }}>Ready to view / print</div></div>
                  </div>

                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 15 }}>
                    <a className="btn primary" href={`/admin/customers/${r.customer_id}/manual-assessment/${r.id}`}>View report / PDF →</a>
                  </div>
                </div>
              ))}
              {!visible.length && <p className="muted" style={{ padding: 20, textAlign: "center" }}>No matching manual assessments.</p>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
