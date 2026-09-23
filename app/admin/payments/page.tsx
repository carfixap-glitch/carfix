"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type PaymentRow = {
  id: string;
  assessment_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  customer: { full_name: string | null; email: string | null; phone: string | null } | null;
  assessment: { city: string | null; vehicle_id: string | null } | null;
  vehicle: { make: string | null; model: string | null; year: number | null } | null;
};

type PaymentRecord = Omit<PaymentRow, "customer" | "assessment" | "vehicle">;
type ProfileRecord = { id: string; full_name: string | null; email: string | null; phone: string | null };
type AssessmentRecord = { id: string; city: string | null; vehicle_id: string | null };
type VehicleRecord = { id: string; make: string | null; model: string | null; year: number | null };

const formatMoney = (amount: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
  : "—";

export default function AdminPaymentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: adminCheck, error: adminError } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (adminError || adminCheck?.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const { data: paymentRows, error: paymentError } = await supabase
        .from("payments")
        .select("id,assessment_id,user_id,amount,currency,status,order_id,payment_id,created_at,updated_at,paid_at")
        .order("created_at", { ascending: false });
      if (paymentError) throw new Error(paymentError.message);

      const base = (paymentRows ?? []) as PaymentRecord[];
      const userIds = [...new Set(base.map((row) => row.user_id).filter(Boolean))];
      const assessmentIds = [...new Set(base.map((row) => row.assessment_id).filter(Boolean))];

      const [{ data: profiles, error: profileError }, { data: assessments, error: assessmentError }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id,full_name,email,phone").in("id", userIds)
          : Promise.resolve({ data: [] as ProfileRecord[], error: null }),
        assessmentIds.length
          ? supabase.from("assessments").select("id,city,vehicle_id").in("id", assessmentIds)
          : Promise.resolve({ data: [] as AssessmentRecord[], error: null }),
      ]);
      if (profileError) throw new Error(profileError.message);
      if (assessmentError) throw new Error(assessmentError.message);

      const assessmentRows = (assessments ?? []) as AssessmentRecord[];
      const vehicleIds = [...new Set(assessmentRows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id)))];
      const { data: vehicles, error: vehicleError } = vehicleIds.length
        ? await supabase.from("vehicles").select("id,make,model,year").in("id", vehicleIds)
        : { data: [] as VehicleRecord[], error: null };
      if (vehicleError) throw new Error(vehicleError.message);

      const profileMap = new Map(((profiles ?? []) as ProfileRecord[]).map((row) => [row.id, row]));
      const assessmentMap = new Map(assessmentRows.map((row) => [row.id, row]));
      const vehicleMap = new Map(((vehicles ?? []) as VehicleRecord[]).map((row) => [row.id, row]));

      setPayments(base.map((row) => {
        const assessment = assessmentMap.get(row.assessment_id) ?? null;
        return {
          ...row,
          customer: profileMap.get(row.user_id) ?? null,
          assessment,
          vehicle: assessment?.vehicle_id ? vehicleMap.get(assessment.vehicle_id) ?? null : null,
        };
      }));
      setLoading(false);
    }

    load().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load payments");
      setLoading(false);
    });
  }, [router, supabase]);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return payments.filter((payment) => {
      if (status !== "all" && payment.status !== status) return false;
      if (!query) return true;
      return `${payment.customer?.full_name ?? ""} ${payment.customer?.email ?? ""} ${payment.customer?.phone ?? ""} ${payment.vehicle?.make ?? ""} ${payment.vehicle?.model ?? ""} ${payment.order_id ?? ""} ${payment.payment_id ?? ""}`
        .toLowerCase().includes(query);
    });
  }, [payments, filter, status]);

  const paid = payments.filter((payment) => payment.status === "paid");
  const collected = paid.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const pending = payments.filter((payment) => payment.status === "pending").length;
  const failed = payments.filter((payment) => payment.status === "failed").length;

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return <main className="admin-list-page section"><div className="container">Loading payments...</div></main>;

  return (
    <main className="admin-list-page">
      <header className="nav">
        <div className="container admin-nav-row">
          <div className="brand"><span>Car</span>Fix <small>ADMIN</small></div>
          <div className="admin-nav-actions">
            <Link className="btn" href="/admin">Assessments</Link>
            <Link className="btn" href="/admin/customers">Customers</Link>
            <Link className="btn" href="/admin/manual-assessments">Manual assessments</Link>
            <button className="btn" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <div className="admin-page-hero">
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="home-kicker">CARFIX PAYMENT CONTROL</div>
              <h1>Every payment, reconciled.</h1>
              <p>Review Razorpay orders, payment outcomes and customer assessment receipts from one read-only workspace.</p>
            </div>
          </div>

          {error && <div className="admin-list-card" style={{ marginTop: 18 }}><p>{error}</p></div>}

          <div className="payment-stats">
            <div className="app-stat"><span>Total collected</span><strong>{formatMoney(collected)}</strong></div>
            <div className="app-stat"><span>Paid payments</span><strong>{paid.length}</strong></div>
            <div className="app-stat"><span>Pending</span><strong>{pending}</strong></div>
            <div className="app-stat"><span>Failed</span><strong>{failed}</strong></div>
          </div>

          <div className="admin-list-card" style={{ marginTop: 18 }}>
            <div className="admin-toolbar">
              <div>
                <div className="home-kicker">PAYMENT HISTORY</div>
                <h2 style={{ margin: "7px 0 0", fontSize: 26, letterSpacing: -1 }}>Razorpay transactions</h2>
                <p className="muted" style={{ marginTop: 5 }}>{payments.length} payment record{payments.length === 1 ? "" : "s"}</p>
              </div>
              <div className="payment-filters">
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter payment status">
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search customer, vehicle or ID" aria-label="Search payments" />
              </div>
            </div>

            <div className="payment-list">
              {visible.map((payment) => (
                <article key={payment.id} className="payment-card">
                  <div className="payment-card-head">
                    <div>
                      <strong>{payment.customer?.full_name || "Customer"}</strong>
                      <p className="muted">{payment.customer?.phone || "No phone"} · {payment.customer?.email || "No email"}</p>
                    </div>
                    <span className={`payment-status payment-status-${payment.status}`}>{payment.status}</span>
                  </div>
                  <div className="payment-detail-grid">
                    <div><small>AMOUNT</small><strong>{formatMoney(Number(payment.amount), payment.currency)}</strong></div>
                    <div><small>VEHICLE</small><strong>{payment.vehicle ? `${payment.vehicle.make || "Vehicle"} ${payment.vehicle.model || ""}` : "—"}</strong></div>
                    <div><small>LOCATION</small><strong>{payment.assessment?.city || "—"}</strong></div>
                    <div><small>{payment.status === "paid" ? "PAID AT" : "CREATED AT"}</small><strong>{formatDate(payment.status === "paid" ? payment.paid_at : payment.created_at)}</strong></div>
                  </div>
                  <div className="payment-identifiers">
                    <div><small>ORDER ID</small><code>{payment.order_id || "Not created"}</code></div>
                    <div><small>PAYMENT ID</small><code>{payment.payment_id || "Not captured"}</code></div>
                  </div>
                  <div className="payment-card-actions">
                    <Link className="btn primary" href={`/assessments/${payment.assessment_id}`}>View assessment →</Link>
                    <Link className="btn" href={`/admin/customers/${payment.user_id}`}>Customer profile</Link>
                  </div>
                </article>
              ))}
              {!visible.length && <p className="muted payment-empty">No matching payments.</p>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
