const stats = [
  ["AI", "damage analysis"],
  ["10+", "photos per assessment"],
  ["₹", "repair cost range"],
];

const features = [
  { icon: "scan", title: "AI visual inspection", text: "Upload clear photos and get a structured assessment of visible exterior body damage." },
  { icon: "rupee", title: "Know the likely cost", text: "See an Indian-market repair and painting estimate before visiting a workshop." },
  { icon: "wrench", title: "Repair vs replace", text: "Understand which panels may need repair, repainting, blending or replacement." },
  { icon: "location", title: "Find the next step", text: "Keep your location, assessment history and service information together." },
];

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "scan") return <svg viewBox="0 0 24 24" {...common}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="4"/><path d="M12 8v8M8 12h8"/></svg>;
  if (name === "rupee") return <svg viewBox="0 0 24 24" {...common}><path d="M6 4h12M6 8h12M9 4c5 0 7 2 7 5s-2 5-7 5l7 6"/></svg>;
  if (name === "wrench") return <svg viewBox="0 0 24 24" {...common}><path d="m14.7 6.3 3-3a5 5 0 0 0-6.4 6.4L4.2 16.8a2.1 2.1 0 0 0 3 3l7.1-7.1a5 5 0 0 0 6.4-6.4l-3 3-3-1-1-3Z"/></svg>;
  if (name === "location") return <svg viewBox="0 0 24 24" {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
  if (name === "arrow") return <svg viewBox="0 0 24 24" {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
  return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="8"/></svg>;
}

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-glow home-glow-one" />
        <div className="home-glow home-glow-two" />

        <header className="home-nav">
          <a className="home-logo" href="/">
            <span>Car</span>Fix<span className="home-logo-dot">.</span>
          </a>
          <nav>
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="/login">Login</a>
            <a className="home-nav-cta" href="/register">Get started <Icon name="arrow" /></a>
          </nav>
        </header>

        <div className="container home-hero-grid">
          <div className="home-hero-copy">
            <div className="home-eyebrow"><span className="home-live-dot" /> AI-powered vehicle assessment</div>
            <h1>Know the damage.<br /><em>Know what to do next.</em></h1>
            <p className="home-hero-text">
              Turn a few car damage photos into a clear, professional assessment with AI analysis, repair guidance and an estimated cost range.
            </p>
            <div className="home-actions">
              <a className="home-primary-btn" href="/register">Start free assessment <Icon name="arrow" /></a>
              <a className="home-secondary-btn" href="#how-it-works">See how it works</a>
            </div>
            <div className="home-trust">
              <div className="home-avatar-stack"><i>✓</i><i>✓</i><i>✓</i></div>
              <span>Simple photo-first workflow</span>
              <b>•</b>
              <span>Built for India</span>
            </div>
          </div>

          <div className="home-dashboard">
            <div className="home-dashboard-top"><span><i /> CarFix AI</span><small>LIVE ANALYSIS</small></div>
            <div className="home-car-stage">
              <div className="home-scan-line" />
              <div className="home-car">
                <div className="home-car-roof" />
                <div className="home-car-window" />
                <div className="home-car-body" />
                <div className="home-car-wheel left" />
                <div className="home-car-wheel right" />
                <div className="home-car-lamp" />
                <div className="home-damage-mark mark-one" />
                <div className="home-damage-mark mark-two" />
              </div>
              <div className="home-float-tag tag-one"><span>01</span> Front bumper</div>
              <div className="home-float-tag tag-two"><span>02</span> Paint scuff</div>
              <div className="home-ai-ring" />
            </div>
            <div className="home-analysis">
              <div><small>VISIBLE DAMAGE</small><strong>2 areas detected</strong></div>
              <div><small>EST. REPAIR</small><strong>₹8,500 — ₹14,000</strong></div>
              <div className="home-status"><span /> AI analysis ready</div>
            </div>
          </div>
        </div>

        <div className="container home-stats">
          {stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
          <p>From photos to a clearer repair decision.</p>
        </div>
      </section>

      <section className="home-section home-intro" id="how-it-works">
        <div className="container">
          <div className="home-section-heading">
            <div><span className="home-kicker">THE CARFIX WAY</span><h2>Less guessing.<br /><span>More clarity.</span></h2></div>
            <p>CarFix turns an uncertain accident or scratch into an organized digital assessment you can understand and act on.</p>
          </div>
          <div className="home-steps">
            <div className="home-step"><span>01</span><div><h3>Capture</h3><p>Take multiple photos around the damaged area and upload them securely.</p></div></div>
            <div className="home-step"><span>02</span><div><h3>Analyze</h3><p>Our AI identifies visible body damage and groups it by affected panel.</p></div></div>
            <div className="home-step"><span>03</span><div><h3>Decide</h3><p>Get repair guidance, cost range and estimated time for the visible work.</p></div></div>
          </div>
        </div>
      </section>

      <section className="home-section home-features" id="features">
        <div className="container">
          <div className="home-kicker">BUILT FOR THE REAL WORLD</div>
          <div className="home-feature-heading"><h2>Everything you need<br /><span>after the damage.</span></h2><p>One clean workflow from your first photo to your next repair decision.</p></div>
          <div className="home-feature-grid">
            {features.map((feature, index) => <article className="home-feature-card" key={feature.title}>
              <div className="home-feature-number">0{index + 1}</div>
              <div className="home-feature-icon"><Icon name={feature.icon} /></div>
              <h3>{feature.title}</h3><p>{feature.text}</p><a href="/register">Explore <Icon name="arrow" /></a>
            </article>)}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="container">
          <div className="home-cta-card">
            <div className="home-cta-orb" />
            <div className="home-kicker">READY WHEN YOU ARE</div>
            <h2>Your car deserves<br /><span>a clearer answer.</span></h2>
            <p>Upload your damage photos and start your CarFix assessment in minutes.</p>
            <a className="home-primary-btn" href="/register">Start your assessment <Icon name="arrow" /></a>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="container"><a className="home-logo" href="/"><span>Car</span>Fix<span className="home-logo-dot">.</span></a><p>AI-assisted vehicle damage assessment.</p><span>© {new Date().getFullYear()} CarFix</span></div>
      </footer>
    </main>
  );
}
