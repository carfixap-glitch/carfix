"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Props = { params: Promise<{ id: string }> };

export default function AssessmentPage({ params }: Props) {
  const [assessmentId, setAssessmentId] = useState("");
  const [a, setA] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  async function load(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("assessments")
      .select("*, vehicles(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      setMessage(`Could not load assessment: ${error.message}`);
      setLoading(false);
      return;
    }

    setA(data);
    setVehicle(data.vehicles);

    const { data: ps } = await supabase
      .from("assessment_photos")
      .select("*")
      .eq("assessment_id", id);

    if (ps) {
      const withUrls = await Promise.all(
        ps.map(async (p) => {
          const { data: u } = await supabase
            .storage
            .from("carfix-damage-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: u?.signedUrl };
        })
      );
      setPhotos(withUrls);
    }

    const { data: da } = await supabase
      .from("damage_analysis")
      .select("*")
      .eq("assessment_id", id)
      .maybeSingle();

    const { data: re } = await supabase
      .from("repair_estimates")
      .select("*")
      .eq("assessment_id", id)
      .maybeSingle();

    setAnalysis(da);
    setEstimate(re);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    params.then(({ id }) => {
      if (!active) return;
      setAssessmentId(id);
      load(id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  async function runAnalysis() {
    if (!assessmentId) return;
    setBusy(true);
    setMessage("AI is analyzing the damage photos...");

    const { data, error } = await supabase.functions.invoke("analyze-car-damage", {
      body: { assessment_id: assessmentId },
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    if (data?.error) {
      setMessage(data.error);
      setBusy(false);
      return;
    }

    await load(assessmentId);
    setMessage("Analysis completed.");
    setBusy(false);
  }

  if (loading) {
    return <main className="section"><div className="container">Loading assessment...</div></main>;
  }

  if (!a) {
    return <main className="section"><div className="container"><h1>Assessment not found</h1><p className="muted">{message}</p><a href="/dashboard">Back to dashboard</a></div></main>;
  }

  return (
    <main>
      <header className="nav"><div className="container"><div className="brand"><span>Car</span>Fix</div></div></header>
      <section className="section">
        <div className="container">
          <a href="/dashboard">← Dashboard</a>
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
              <ul>{(analysis.damaged_parts || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              <h3 style={{ marginTop: 18 }}>Recommendations</h3>
              <ul>{(analysis.recommendations || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              <h3 style={{ marginTop: 18 }}>Repair or replacement</h3>
              <ul>{(analysis.repair_or_replacement || []).map((x: any, i: number) => <li key={i}><strong>{x.part}</strong>: {x.action}</li>)}</ul>
            </div>
            {estimate && <div className="card" style={{ marginTop: 20 }}>
              <h2>Preliminary repair estimate</h2>
              <p style={{ fontSize: 28, fontWeight: 700 }}>₹{Number(estimate.estimated_min_cost).toLocaleString("en-IN")} – ₹{Number(estimate.estimated_max_cost).toLocaleString("en-IN")}</p>
              <p><strong>Estimated time:</strong> {estimate.estimated_time_min}–{estimate.estimated_time_max} hours</p>
              <p className="muted" style={{ marginTop: 12 }}>{estimate.notes}</p>
            </div>}
          </>}
        </div>
      </section>
    </main>
  );
}
