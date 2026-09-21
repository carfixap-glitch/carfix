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
  const [isAdmin, setIsAdmin] = useState(false);
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
      const admin = adminResult === true;
      setIsAdmin(admin);

      let assessmentQuery = supabase
        .from("assessments")
        .select("*")
        .eq("id", id);

      if (!admin) assessmentQuery = assessmentQuery.eq("user_id", user.id);

      const { data, error } = await assessmentQuery.maybeSingle();
      if (error) throw new Error(`Could not load assessment: ${error.message}`);
      if (!data) throw new Error("Assessment not found or you do not have permission to view it.");

      setA(data);

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

  const showAiLoader = loading || busy;

  if (showAiLoader) return (
    <main className="ai-loading-page">
      <div className="ai-loader-card">
        <div className="ai-loader-scene" aria-hidden="true">
          <div className="ai-grid"></div>
          <div className="ai-scan-beam"></div>
          <div className="ai-car">
            <div className="ai-car-roof"></div>
            <div className="ai-car-window"></div>
            <div className="ai-car-body"></div>
            <div className="ai-wheel ai-wheel-left"></div>
            <div className="ai-wheel ai-wheel-right"></div>
            <div className="ai-light"></div>
          </div>
          <div className="ai-radar"><i></i></div>
          <div className="ai-dot dot-one"></div>
          <div className="ai-dot dot-two"></div>
          <div className="ai-dot dot-three"></div>
        </div>
        <div className="ai-loader-logo">Car<span>Fix</span></div>
        <h1>{loading ? "Preparing your assessment" : "AI is inspecting your car"}</h1>
        <p>{loading ? "Loading your photos and assessment details…" : "Scanning damage, identifying affected parts and preparing your repair estimate…"}</p>
        <div className="ai-progress"><span></span></div>
        <div className="ai-status"><b></b> {loading ? "Loading securely" : "AI analysis in progress"}</div>
      </div>
    </main>
  );

  if (!a) return (
    <main className="section">
      <div className="container">
        <h1>Assessment could not be loaded</h1>
        <p className="muted">{message}</p>
        <a href={isAdmin ? "/admin" : "/dashboard"}>
          {isAdmin ? "Back to admin dashboard" : "Back to dashboard"}
        </a>
      </div>
    </main>
  );

  const damagedParts = toArray<string>(analysis?.damaged_parts);
  const recommendations = toArray<string>(analysis?.recommendations);
  const repairOrReplacement = toArray<{ part?: string; action?: string }>(analysis?.repair_or_replacement);
  const mapQuery = encodeURIComponent(`car repair workshop ${a.city ?? ""}`);

  return (
    <main className="result-page">
      <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><a className="brand" href="/"><span>Car</span>Fix.</a><a className="btn" href={isAdmin?"/admin":"/dashboard"}>{isAdmin?"Admin dashboard":"My dashboard"}</a></div></header>
      <section className="section"><div className="container">
        <div className="result-top"><div><div className="home-kicker">CARFIX AI REPORT</div><h1>{vehicle?.make} {vehicle?.model}</h1><p className="muted">{a.city||"Location captured"} · {new Date(a.created_at).toLocaleDateString("en-IN")} · <span className="home-pill">{a.status}</span></p></div><div className="result-scope">BODY REPAIR<br/><b>& PAINTING ONLY</b></div></div>
        <div className="result-photo-strip">{photos.slice(0,4).map((p)=><div key={p.id}>{p.url&&<img src={p.url} alt="Car damage"/></div>)}</div>
        {!analysis&&<div className="result-empty card"><div className="result-empty-icon">✦</div><h2>Your AI report is ready to generate.</h2><p className="muted">CarFix will inspect the visible exterior damage in your uploaded photos and prepare a preliminary repair estimate.</p><button className="home-primary-btn" onClick={runAnalysis} disabled={busy}>{busy?"Analyzing your car…":"Analyze with CarFix AI →"}</button></div>}
        {analysis&&<><div className="result-summary-grid"><div className="result-main-card"><div className="home-kicker">DAMAGE SUMMARY</div><h2>{analysis.damage_description}</h2><div className="result-severity"><span>VISIBLE SEVERITY</span><strong>{analysis.severity}</strong></div></div>{estimate&&<div className="result-cost-card"><span>PRELIMINARY REPAIR RANGE</span><strong>₹{Number(estimate.estimated_min_cost).toLocaleString("en-IN")} – ₹{Number(estimate.estimated_max_cost).toLocaleString("en-IN")}</strong><small>Estimated time: {estimate.estimated_time_min}–{estimate.estimated_time_max} hours</small></div>}</div>
        <div className="result-content-grid"><div className="card"><div className="home-kicker">VISIBLE DAMAGE</div><h2>Affected areas</h2><ul className="result-list">{damagedParts.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="card"><div className="home-kicker">NEXT STEPS</div><h2>Recommendations</h2><ul className="result-list">{recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul></div></div>
        <div className="card" style={{marginTop:18}}><div className="home-kicker">REPAIR PLAN</div><h2>Repair or replacement</h2><div className="repair-table">{repairOrReplacement.map((x,i)=><div key={i}><strong>{x.part||"Body panel"}</strong><span>{x.action||"Review required"}</span></div>)}</div>{estimate?.notes&&<p className="muted" style={{marginTop:18}}>{estimate.notes}</p>}</div>
        <div className="card" style={{marginTop:18}}><div className="home-kicker">WORKSHOP OPTIONS</div><h2>Find your next step</h2><p className="muted">Explore nearby body repair workshops{a.city ? " around " + a.city : ""}.</p><a className="btn primary" href={"https://www.google.com/maps/search/?api=1&query="+mapQuery} target="_blank" rel="noreferrer" style={{marginTop:12}}>Find workshops →</a></div></>}
        {message&&<p className="muted" style={{marginTop:14}}>{message}</p>}
      </div></section>
    </main>
  );
}