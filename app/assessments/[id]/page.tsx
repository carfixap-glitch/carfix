"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Props = { params: Promise<{ id: string }> };

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return value.trim() ? [value as T] : [];
    }
  }
  return [];
}

export default function AssessmentPage({ params }: Props) {
  const [assessmentId, setAssessmentId] = useState("");
  const [a, setA] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  async function load(id: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // Admins can open any customer's assessment. Customers can only open
      // their own assessment. This is also enforced by the database RLS.
      const { data: adminResult, error: adminCheckError } = await supabase.rpc("is_admin");
      if (adminCheckError) throw new Error(`Could not verify administrator access: ${adminCheckError.message}`);
      const isAdmin = adminResult === true;

      let assessmentQuery = supabase
        .from("assessments")
        .select("*")
        .eq("id", id);

      if (!isAdmin) assessmentQuery = assessmentQuery.eq("user_id", user.id);

      const { data, error } = await assessmentQuery.maybeSingle();
      if (error) throw new Error(`Could not load assessment: ${error.message}`);
      if (!data) throw new Error("Assessment not found or you do not have permission to view it.");

      setA(data);

      // Load the vehicle separately so this page is reliable for both
      // customer and admin sessions and does not depend on a nested relation.
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", data.vehicle_id)
        .maybeSingle();
      if (vehicleError) throw new Error(`Could not load vehicle: ${vehicleError.message}`);
      setVehicle(vehicleData);

      const { data: ps, error: photoError } = await supabase
        .from("assessment_photos")
        .select("*")
        .eq("assessment_id", id);
      if (photoError) throw new Error(`Could not load assessment photos: ${photoError.message}`);

      if (ps) {
        const withUrls = await Promise.all(ps.map(async (p) => {
          const { data: u } = await supabase
            .storage
            .from("carfix-damage-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: u?.signedUrl };
        }));
        setPhotos(withUrls);
      }

      const { data: da, error: daError } = await supabase
        .from("damage_analysis")
        .select("*")
        .eq("assessment_id", id)
        .maybeSingle();
      if (daError) throw new Error(`Could not load AI analysis: ${daError.message}`);

      const { data: re, error: reError } = await supabase
        .from("repair_estimates")
        .select("*")
        .eq("assessment_id", id)
        .maybeSingle();
      if (reError) throw new Error(`Could not load repair estimate: ${reError.message}`);

      setAnalysis(da);
      setEstimate(re);

      const city = String(data.city ?? "").trim();
      if (city) {
        const { data: nearbyGarages } = await supabase
          .from("garages")
          .select("id, name, phone, address, city, services, latitude, longitude")
          .ilike("city", city)
          .limit(5);
        setGarages(nearbyGarages ?? []);
      } else {
        setGarages([]);
      }

      setLoading(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load assessment");
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    params.then(({ id }) => {
      if (!active) return;
      setAssessmentId(id);
      load(id);
    }).catch((error) => {
      if (active) {
        setMessage(error instanceof Error ? error.message : "Could not open assessment");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [params]);

  async function runAnalysis() {
    if (!assessmentId || busy) return;
    setBusy(true);
    setMessage("AI is analyzing the damage photos. This may take a little while...");

    try {
      const { data, error } = await supabase.functions.invoke("analyze-car-damage-v2", {
        body: { assessment_id: assessmentId },
      });

      if (error) throw new Error(error.message || "AI analysis request failed");
      if (data?.error) throw new Error(data.error);

      await load(assessmentId);
      setMessage("Analysis completed successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI analysis failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="section"><div className="container">Loading assessment...</div></main>;

  if (!a) return <main className="section"><div className="container"><h1>Assessment could not be loaded</h1><p className="muted">{message}</p><a href="/admin">Back to admin dashboard</a></div></main>;

  const damagedParts = toArray<string>(analysis?.damaged_parts);
  const recommendations = toArray<string>(analysis?.recommendations);
  const repairOrReplacement = toArray<{ part?: string; action?: string }>(analysis?.repair_or_replacement);
  const mapQuery = encodeURIComponent(`car repair workshop ${a.city ?? ""}`);

  return (
    <main>
      <header className="nav"><div className="container"><div className="brand"><span>Car</span>Fix</div></div></header>
      <section className="section">
        <div className="container">
          <a href="/admin">← Admin Dashboard</a>
          <p className="muted" style={{ marginTop: 25 }}>Assessment</p>
          <h1>{vehicle?.make} {vehicle?.model}</h1>
          <p className="muted">{vehicle?.year} · {a.city} · Status: {a.status}</p>

          <div className="card" style={{ marginTop: 25 }}>
            <h2>Damage photos</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 18 }}>
              {photos.map((p) => (
                <div key={p.id} className="card" style={{ padding: 8 }}>
                  {p.url && <img src={p.url} alt="Car damage" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 8 }} />}
                </div>
              ))}
            </div>
            <button className="btn primary" onClick={runAnalysis} disabled={busy || !photos.length} style={{ marginTop: 22 }}>
              {busy ? "Analyzing..." : analysis ? "Run analysis again" : "Analyze damage with AI"}
            </button>
            {message && <p className="muted" style={{ marginTop: 12 }}>{message}</p>}
          </div>

          {analysis && <>
            <div className="card" style={{ marginTop: 20 }}>
              <h2>AI damage assessment</h2>
              <p>{analysis.damage_description}</p>
              <p style={{ marginTop: 14 }}><strong>Severity:</strong> {analysis.severity}</p>
              <h3 style={{ marginTop: 18 }}>Damaged parts</h3>
              <ul>{damagedParts.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <h3 style={{ marginTop: 18 }}>Recommendations</h3>
              <ul>{recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <h3 style={{ marginTop: 18 }}>Repair or replacement</h3>
              <ul>{repairOrReplacement.map((x, i) => <li key={i}><strong>{x.part || "Part"}</strong>: {x.action || "Review"}</li>)}</ul>
            </div>
            {estimate && <div className="card" style={{ marginTop: 20 }}>
              <h2>Preliminary repair estimate</h2>
              <p style={{ fontSize: 28, fontWeight: 700 }}>₹{Number(estimate.estimated_min_cost).toLocaleString("en-IN")} – ₹{Number(estimate.estimated_max_cost).toLocaleString("en-IN")}</p>
              <p><strong>Estimated time:</strong> {estimate.estimated_time_min}–{estimate.estimated_time_max} hours</p>
              <p className="muted" style={{ marginTop: 12 }}>{estimate.notes}</p>
            </div>}

            <div className="card" style={{ marginTop: 20 }}>
              <h2>Nearby workshop options</h2>
              <p className="muted">Based on the city selected for this assessment: <strong>{a.city}</strong>.</p>
              {garages.length > 0 ? (
                <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                  {garages.map((garage) => {
                    const services = toArray<string>(garage.services);
                    const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(garage.name + ", " + garage.address)}`;
                    return (
                      <div key={garage.id} className="card" style={{ padding: 16 }}>
                        <h3>{garage.name}</h3>
                        <p style={{ marginTop: 6 }}>{garage.address}</p>
                        {garage.phone && <p className="muted" style={{ marginTop: 5 }}>Phone: {garage.phone}</p>}
                        {services.length > 0 && <p className="muted" style={{ marginTop: 5 }}>Services: {services.join(" · ")}</p>}
                        <a className="btn" href={directions} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>Get directions</a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 18 }}>No workshop records are stored for this city yet. Use the map search below to find current nearby options.</p>
              )}
              <a className="btn primary" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" style={{ marginTop: 18 }}>
                Find more workshops near {a.city}
              </a>
            </div>
          </>}
        </div>
      </section>
    </main>
  );
}
