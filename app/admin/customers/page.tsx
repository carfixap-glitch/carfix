"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  assessmentCount: number;
};

export default function AdminCustomersPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: adminCheck, error: adminError } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (adminError || adminCheck?.role !== "admin") {
        window.location.href = "/dashboard";
        return;
      }

      const [{ data: profiles, error: pe }, { data: assessments, error: ae }] = await Promise.all([
        supabase.from("profiles")
          .select("id,full_name,phone,email,created_at")
          .eq("role", "customer")
          .order("created_at", { ascending: false }),
        supabase.from("assessments").select("user_id")
      ]);

      if (pe) throw new Error(pe.message);
      if (ae) throw new Error(ae.message);

      const counts = new Map<string, number>();
      (assessments ?? []).forEach((a: any) => {
        if (a.user_id) counts.set(a.user_id, (counts.get(a.user_id) ?? 0) + 1);
      });

      setCustomers((profiles ?? []).map((p: any) => ({
        ...p,
        assessmentCount: counts.get(p.id) ?? 0
      })));
      setLoading(false);
    })().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load customers");
      setLoading(false);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.full_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q)
    );
  }, [customers, filter]);

  if (loading) {
    return <main className="admin-list-page section"><div className="container">Loading customers...</div></main>;
  }

  return (
    <main className="admin-list-page">
      <header className="nav">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div className="brand"><span>Car</span>Fix <small style={{ fontSize: 11, marginLeft: 8, color: "#667085" }}>ADMIN</small></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/admin">Assessments</a>
            <a className="btn" href="/admin/manual-assessments">Manual assessments</a>
            <button className="btn" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <div className="admin-page-hero">
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="home-kicker">CARFIX CUSTOMER HUB</div>
              <h1>Customers, clearly.</h1>
              <p>Search customer accounts, review assessment activity and open a profile for detailed workshop management.</p>
            </div>
          </div>

          {error && <div className="admin-list-card" style={{ marginTop: 18 }}><p>{error}</p></div>}

          <div className="admin-list-card" style={{ marginTop: 18 }}>
            <div className="admin-toolbar">
              <div>
                <div className="home-kicker">CUSTOMER ACCOUNTS</div>
                <h2 style={{ margin: "7px 0 0", fontSize: 26, letterSpacing: -1 }}>All customers</h2>
                <p className="muted" style={{ marginTop: 5 }}>{customers.length} registered customer{customers.length === 1 ? "" : "s"}</p>
              </div>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search name, phone or email"
                aria-label="Search customers"
              />
            </div>

            <div style={{ display: "grid", gap: 11, marginTop: 20 }}>
              {visible.map((c) => (
                <div key={c.id} className="admin-item">
                  <div className="admin-item-top">
                    <div>
                      <strong>{c.full_name || "Customer"}</strong>
                      <div className="admin-item-meta">
                        {c.phone || "No phone"} · {c.email || "No email"}<br />
                        Joined {new Date(c.created_at).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <span className="admin-chip">{c.assessmentCount} assessment{c.assessmentCount === 1 ? "" : "s"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 14 }}>
                    <a className="btn primary" href={`/admin/customers/${c.id}`}>Open customer profile →</a>
                  </div>
                </div>
              ))}
              {!visible.length && <p className="muted" style={{ padding: 20, textAlign: "center" }}>No matching customers.</p>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
