"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { getFunctionErrorMessage } from "@/lib/function-error";

type Props = { params: Promise<{ id: string }> };
type PaymentReceipt = {
  amount: number | string;
  currency: string;
  status: string;
  order_id: string | null;
  payment_id: string | null;
  paid_at: string | null;
};

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
  const [payment, setPayment] = useState<PaymentReceipt | null>(null);
  const [garages, setGarages] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
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

      const canViewFullAssessment = admin || !data.payment_required || data.payment_status === "free" || data.payment_status === "paid";

      const city = String(data.city ?? "").trim();
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);

      const vehicleQuery = supabase.from("vehicles").select("*").eq("id", data.vehicle_id).maybeSingle();
      const photosQuery = supabase.from("assessment_photos").select("*").eq("assessment_id", id);
      const analysisQuery = canViewFullAssessment
        ? supabase
          .from("damage_analysis")
          .select("*")
          .eq("assessment_id", id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });
      const estimateQuery = canViewFullAssessment
        ? supabase
          .from("repair_estimates")
          .select("*")
          .eq("assessment_id", id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });
      const garagesQuery = city
        ? supabase
          .from("garages")
          .select("id, name, phone, address, city, services, latitude, longitude, workshop_category")
          .eq("workshop_category", "body_paint")
          .ilike("city", city)
          .limit(10)
        : Promise.resolve({ data: [], error: null });
      const paymentQuery = data.payment_required && data.payment_status === "paid"
        ? supabase.from("payments")
          .select("amount,currency,status,order_id,payment_id,paid_at")
          .eq("assessment_id", id)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [
        { data: vehicleData, error: vehicleError },
        { data: ps, error: photoError },
        { data: analysisData, error: analysisError },
        { data: estimateData, error: estimateError },
        { data: nearbyGarages, error: garagesError },
        { data: paymentData, error: paymentError },
      ] = await Promise.all([vehicleQuery, photosQuery, analysisQuery, estimateQuery, garagesQuery, paymentQuery]);

      if (vehicleError) throw new Error(`Could not load vehicle: ${vehicleError.message}`);
      if (photoError) throw new Error(`Could not load assessment photos: ${photoError.message}`);
      if (analysisError) throw new Error(`Could not load AI analysis: ${analysisError.message}`);
      if (estimateError) throw new Error(`Could not load repair estimate: ${estimateError.message}`);
      if (garagesError) throw new Error(`Could not load nearby workshops: ${garagesError.message}`);
      if (paymentError) throw new Error(`Could not load payment receipt: ${paymentError.message}`);

      setVehicle(vehicleData);
      setAnalysis(analysisData);
      setEstimate(estimateData);
      setPayment(paymentData);

      if (ps?.length) {
        const assessmentPhotos = ps as Array<Record<string, unknown> & { storage_path: string }>;
        const paths = assessmentPhotos.map(photo => photo.storage_path);
        const { data: signedUrls, error: signedUrlError } = await supabase
          .storage
          .from("carfix-damage-photos")
          .createSignedUrls(paths, 3600);
        if (signedUrlError) throw new Error(`Could not load assessment photos: ${signedUrlError.message}`);
        setPhotos(assessmentPhotos.map((photo, index) => ({ ...photo, url: signedUrls?.[index]?.signedUrl })));
      } else {
        setPhotos([]);
      }

      if (city) {
        const ranked = (nearbyGarages ?? []).map((garage: any) => {
          const glat = Number(garage.latitude);
          const glon = Number(garage.longitude);
          let distanceKm: number | null = null;
          if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(glat) && Number.isFinite(glon)) {
            const toRad = (v: number) => v * Math.PI / 180;
            const dLat = toRad(glat - latitude);
            const dLon = toRad(glon - longitude);
            const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latitude)) * Math.cos(toRad(glat)) * Math.sin(dLon / 2) ** 2;
            distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
          }
          return { ...garage, distanceKm };
        }).sort((x: any, y: any) => {
          if (x.name === "Clean Cars") return -1;
          if (y.name === "Clean Cars") return 1;
          if (x.distanceKm == null) return 1;
          if (y.distanceKm == null) return -1;
          return x.distanceKm - y.distanceKm;
        }).slice(0, 5);
        setGarages(ranked);
      } else {
        setGarages([]);
      }

      setLoading(false);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "Assessment not found or you do not have permission to view it."
          ? error.message
          : "Could not load this assessment. Please try again.",
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    params.then(({ id }) => {
      if (!active) return;
      setAssessmentId(id);
      load(id);
    }).catch(() => {
      if (active) {
        setMessage("Could not open this assessment. Please return to your dashboard and try again.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [params]);

  async function startPayment() {
    if (!assessmentId || paymentBusy) return;
    setPaymentBusy(true);
    setMessage("Preparing secure payment…");
    try {
      const { data, error } = await supabase.functions.invoke("create-razorpay-order-v2", { body: { assessment_id: assessmentId } });
      if (error) throw new Error(await getFunctionErrorMessage(error, "Could not create payment order"));
      if (typeof data?.error === "string") throw new Error(data.error);
      if (data?.error?.message) throw new Error(data.error.message);
      if (!data?.order_id) { await load(assessmentId); return; }

      const scriptId = "razorpay-checkout-script";
      if (!document.getElementById(scriptId)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
          document.body.appendChild(script);
        });
      }
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Razorpay checkout is unavailable");
      const checkout = new Razorpay({
        key: data.key_id, amount: data.amount, currency: data.currency, name: "CarFix",
        description: "CarFix damage assessment", order_id: data.order_id, theme: { color: "#111111" },
        handler: async (response: any) => {
          try {
            setMessage("Verifying your payment securely…");
            const { data: verified, error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment-v2", {
              body: { assessment_id: assessmentId, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature },
            });
            if (verifyError) throw new Error(await getFunctionErrorMessage(verifyError, "Payment verification failed"));
            if (typeof verified?.error === "string") throw new Error(verified.error);
            if (verified?.error?.message) throw new Error(verified.error.message);
            await load(assessmentId);
            setMessage("Payment successful. Your full assessment is now unlocked.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Payment verification failed");
          } finally { setPaymentBusy(false); }
        },
        modal: { ondismiss: () => setPaymentBusy(false) },
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment");
      setPaymentBusy(false);
    }
  }

  async function runAnalysis() {
    if (!assessmentId || busy) return;
    setBusy(true);
    setMessage("AI is analyzing the damage photos. This may take a little while...");

    try {
      const { data, error } = await supabase.functions.invoke("analyze-car-damage-v2", {
        body: { assessment_id: assessmentId },
      });

      if (error) throw new Error(await getFunctionErrorMessage(error, "AI analysis request failed"));
      if (typeof data?.error === "string") throw new Error(data.error);
      if (data?.error?.message) throw new Error(data.error.message);

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
        <div className="result-photo-strip">{photos.slice(0,4).map((p)=><div key={p.id}>{p.url&&<img src={p.url} alt="Car damage"/>}</div>)}</div>
        {a.payment_required && a.payment_status !== "paid" && !isAdmin ? <div className="result-empty card"><div className="result-empty-icon">₹</div><div className="home-kicker">ASSESSMENT PAYMENT</div><h2>Unlock your CarFix assessment</h2><p className="muted">Your first assessment is free. This assessment is ₹{Number(a.payment_amount || 199).toLocaleString("en-IN")} and includes the full AI damage report, repair estimate and workshop recommendations.</p><button className="home-primary-btn" onClick={startPayment} disabled={paymentBusy}>{paymentBusy ? "Preparing payment…" : "Pay ₹199 & unlock report →"}</button><small className="muted" style={{display:"block",marginTop:12}}>Secure checkout powered by Razorpay.</small></div> : !analysis ? <div className="result-empty card"><div className="result-empty-icon">✦</div><h2>Your AI report is ready to generate.</h2><p className="muted">CarFix will inspect the visible exterior damage in your uploaded photos and prepare a preliminary repair estimate.</p><button className="home-primary-btn" onClick={runAnalysis} disabled={busy}>{busy?"Analyzing your car…":"Analyze with CarFix AI →"}</button></div> : null}
        {payment && <div className="card" style={{marginTop:18}}><div className="home-kicker">PAYMENT RECEIPT</div><h2>Payment confirmed</h2><p className="muted">₹{Number(payment.amount).toLocaleString("en-IN")} {payment.currency} · Paid {payment.paid_at ? new Date(payment.paid_at).toLocaleString("en-IN") : "successfully"}</p><small className="muted">Payment ID: {payment.payment_id}</small></div>}
        {analysis&&<><div className="result-summary-grid"><div className="result-main-card"><div className="home-kicker">DAMAGE SUMMARY</div><h2>{analysis.damage_description}</h2><div className="result-severity"><span>VISIBLE SEVERITY</span><strong>{analysis.severity}</strong></div></div>{estimate&&<div className="result-cost-card"><span>PRELIMINARY REPAIR RANGE</span><strong>₹{Number(estimate.estimated_min_cost).toLocaleString("en-IN")} – ₹{Number(estimate.estimated_max_cost).toLocaleString("en-IN")}</strong><small>Estimated time: {estimate.estimated_time_min}–{estimate.estimated_time_max} hours</small></div>}</div>
        <div className="result-content-grid"><div className="card"><div className="home-kicker">VISIBLE DAMAGE</div><h2>Affected areas</h2><ul className="result-list">{damagedParts.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="card"><div className="home-kicker">NEXT STEPS</div><h2>Recommendations</h2><ul className="result-list">{recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul></div></div>
        <div className="card" style={{marginTop:18}}><div className="home-kicker">REPAIR PLAN</div><h2>Repair or replacement</h2><div className="repair-table">{repairOrReplacement.map((x,i)=><div key={i}><strong>{x.part||"Body panel"}</strong><span>{x.action||"Review required"}</span></div>)}</div>{estimate?.notes&&<p className="muted" style={{marginTop:18}}>{estimate.notes}</p>}</div>
        <div className="card workshop-results" style={{marginTop:18}}><div className="home-kicker">BODY REPAIR & PAINTING WORKSHOPS</div><div className="workshop-heading-row"><div><h2>Find a specialist workshop</h2><p className="muted">Optional. Find nearby workshops specifically for car body repair, dent repair and painting using your captured location.</p></div><a className="btn primary" href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("car body repair painting workshop near " + (a.address || a.city || "me"))} target="_blank" rel="noreferrer">Find workshops →</a></div>{garages.length > 0 ? <div className="workshop-list">{garages.map((g: any, index: number) => <div className="workshop-item" key={g.id}><div className="workshop-rank">{index + 1}</div><div className="workshop-info"><div className="workshop-title-row"><h3>{g.name}</h3>{g.name === "Clean Cars" && <span className="workshop-recommended">Recommended</span>}</div><p>{g.address || g.city}</p><div className="workshop-services">{toArray<string>(g.services).slice(0, 5).map((service, i) => <span key={i}>{service}</span>)}</div>{g.distanceKm != null && <small>{g.distanceKm < 1 ? Math.round(g.distanceKm * 1000) + " m away" : g.distanceKm.toFixed(1) + " km away"}</small>}</div><div className="workshop-actions">{g.phone && <a className="btn" href={"tel:" + g.phone}>Call</a>}<a className="btn primary" href={"https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(g.latitude && g.longitude ? g.latitude + "," + g.longitude : g.address || g.name)} target="_blank" rel="noreferrer">Directions</a></div></div>)}</div> : <div className="workshop-empty"><strong>No specialist workshops are listed in CarFix for this location yet.</strong><span>Use the button above to find body repair and painting workshops near your captured GPS location.</span></div>}</div></>}
        {message&&<p className="muted" style={{marginTop:14}}>{message}</p>}
      </div></section>
    </main>
  );
}
