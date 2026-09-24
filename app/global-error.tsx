"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#07111f", color: "#fff", fontFamily: "Arial, sans-serif" }}>
          <section style={{ width: "min(560px, 100%)", padding: 36, border: "1px solid #334155", borderRadius: 22, background: "#0b1729", textAlign: "center" }} role="alert">
            <p style={{ color: "#60a5fa", fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>CARFIX RECOVERY</p>
            <h1 style={{ margin: "12px 0", fontSize: 36 }}>Something went wrong.</h1>
            <p style={{ color: "#aeb9ca", lineHeight: 1.6 }}>No payment or assessment action was repeated. Please retry safely.</p>
            <button type="button" onClick={reset} style={{ marginTop: 18, padding: "13px 20px", border: 0, borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
