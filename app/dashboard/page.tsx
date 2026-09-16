"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Assessment = {
  id: string;
  city: string | null;
  status: string | null;
  created_at: string;
  vehicle: { make: string | null; model: string | null; year: number | null } | null;
  severity?: string | null;
  minCost?: number | null;
  maxCost?: number | null;
};

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setEmail(user.email ?? "");

      // Load assessments first, then vehicles separately. This avoids a fragile
      // nested relationship query and makes existing history reliably visible.
      const { data: rows, error: assessmentError } = await supabase
        .from("assessments")
        .select("id, vehicle_id, city, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (assessmentError) throw new Error(`Could not load assessment history: ${assessmentError.message}`);

      const base = rows ?? [];
      if (!base.length) {
        setAssessments([]);
        setLoading(false);
        return;
      }

      const vehicleIds = [...new Set(base.map((x: any) => x.vehicle_id).filter(Boolean))];
      const assessmentIds = base.map((x: any) => x.id);

      const [{ data: vehicles }, { data: analyses }, { data: estimates }] = await Promise.all([
        vehicleIds.length ? supabase.from("vehicles").select("id, make, model, year").in("id", vehicleIds) : Promise.resolve({ data: [] as any[] }),
        supabase.from("damage_analysis").select("assessment_id, severity").in("assessment_id", assessmentIds),
        supabase.from("repair_estimates").select("assessment_id, estimated_min_cost, estimated_max_cost").in("assessment_id", assessmentIds),
      ]);

      const vehicleMap = new Map((vehicles ?? []).map((v: any) => [v.id, v]));
      const analysisMap = new Map((analyses ?? []).map((a: any) => [a.assessment_id, a]));
      const estimateMap = new Map((estimates ?? []).map((e: any) => [e.assessment_id, e]));

      setAssessments(base.map((a: any) => {
        const analysis = analysisMap.get(a.id);
        const estimate = estimateMap.get(a.id);
        return {
          id: a.id,
          city: a.city,
          status: a.status,
          created_at: a.created_at,
          vehicle: vehicleMap.get(a.vehicle_id) ?? null,
          severity: analysis?.severity ?? null,
          minCost: estimate?.estimated_min_cost ?? null,
          maxCost: estimate?.estimated_max_cost ?? null,
        };
      }));
      setLoading(false);
    }

    loadDashboard().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
      setLoading(false);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <main className="section"><div className="container">Loading dashboard...</div></main>;

  return (
    <main>
      <header className="nav">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="brand"><span>Car</span>Fix</div>
          <button className="btn" onClick={logout}>Sign out</button>
        </div>
      </header>
      <section className="section">
        <div className="container">
          <p className="muted">Customer dashboard</p>
          <h1>Your assessments</h1>
          <p className="muted">Signed in as {email}</p>
          {error && <div className="card" style={{ marginTop: 20 }}><p>{error}</p></div>}

          <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", marginTop: 24 }}>
            <div className="card">
              <h3>Start a new assessment</h3>
              <p>Enter your vehicle details and upload damage photos.</p>
              <a className="btn primary" href="/assessments/new" style={{ marginTop: 18 }}>New assessment</a>
            </div>

            <div className="card">
              <h3>Assessment history</h3>
              <p>Your previous assessments are saved here.</p>
              {!assessments.length && <p className="muted" style={{ marginTop: 18 }}>No assessments found.</p>}
              {assessments.length > 0 && (
                <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                  {assessments.map((item) => (
                    <a key={item.id} href={`/assessments/${item.id}`} className="card" style={{ display: "block", textDecoration: "none", padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong>{item.vehicle?.make ?? "Vehicle"} {item.vehicle?.model ?? ""} {item.vehicle?.year ? `(${item.vehicle.year})` : ""}</strong>
                        <span className="muted" style={{ textTransform: "capitalize" }}>{item.status ?? "pending"}</span>
                      </div>
                      <p className="muted" style={{ marginTop: 6 }}>{item.city || "Location not provided"} · {new Date(item.created_at).toLocaleString("en-IN")}</p>
                      {item.severity && <p style={{ marginTop: 8 }}><strong>AI severity:</strong> {item.severity}</p>}
                      {item.minCost != null && item.maxCost != null && <p style={{ marginTop: 4 }}><strong>Estimate:</strong> ₹{Number(item.minCost).toLocaleString("en-IN")} – ₹{Number(item.maxCost).toLocaleString("en-IN")}</p>}
                      <span className="muted" style={{ display: "inline-block", marginTop: 8 }}>View full assessment →</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
