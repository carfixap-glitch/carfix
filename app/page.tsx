const features = [
  ["📷", "Photo-based assessment", "Upload multiple photos of your vehicle damage for a single assessment."],
  ["🤖", "AI damage analysis", "Analyze visible damage and organize findings by affected vehicle parts."],
  ["₹", "Repair estimates", "Get an estimated repair cost range and expected repair time."],
  ["🔧", "Repair guidance", "Understand whether affected parts may need repair or replacement."],
  ["📍", "Garage information", "Keep service and garage recommendations together with the assessment."],
  ["📊", "Customer & admin dashboards", "Customers see their assessments while admins manage the full workflow."],
];

export default function Home() {
  return (
    <main>
      <header className="nav">
        <div className="container" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div className="brand"><span>Car</span>Fix</div>
          <nav className="navlinks"><a href="/login">Login</a><a href="/register">Register</a></nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div style={{fontWeight:700,color:"#2563eb",marginBottom:14}}>AI-POWERED CAR DAMAGE ASSESSMENT</div>
          <h1>Turn car damage photos into a clear repair assessment.</h1>
          <p>CarFix brings vehicle details, damage photos, AI analysis, repair guidance, cost estimates and garage information into one simple workflow.</p>
          <div className="actions"><a className="btn primary" href="/register">Start an assessment</a><a className="btn" href="/login">Customer login</a></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Everything for the assessment workflow</h2>
          <p className="muted">Designed for customers and the CarFix operations team.</p>
          <div className="grid">
            {features.map(([icon,title,description]) => <div className="card" key={title}><div style={{fontSize:28,marginBottom:14}}>{icon}</div><h3>{title}</h3><p>{description}</p></div>)}
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container">© {new Date().getFullYear()} CarFix. AI-assisted vehicle damage assessment.</div></footer>
    </main>
  );
}
