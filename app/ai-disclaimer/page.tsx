export default function AiDisclaimerPage() {
  return (
    <main className="legal-page"><article className="legal-card">
      <a className="legal-logo" href="/">Car<span>Fix</span></a>
      <p className="legal-kicker">IMPORTANT INFORMATION</p><h1>AI Assessment Disclaimer</h1>
      <p>CarFix provides an <strong>AI-generated preliminary assessment of visible vehicle body, dent, scratch and paint damage</strong> based on photographs, vehicle information, location information and other details supplied by the customer.</p>
      <p>The assessment is not a physical vehicle inspection, professional workshop quotation, insurance assessment or guarantee of repair requirements.</p>
      <p>AI may not identify hidden, internal, mechanical, electrical, structural or other damage that is not clearly visible in the information provided.</p>
      <p>Repair and painting costs vary according to location, workshop rates, vehicle model, parts availability, repair methods and damage discovered during physical inspection. Any cost shown by CarFix is therefore an <strong>estimated range for guidance only</strong> and may differ from the final amount charged by a repair provider.</p>
      <p>Customers should obtain a physical inspection and final quotation from a qualified repair professional before proceeding with repairs.</p>
      <nav className="legal-links"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/">Back to CarFix</a></nav>
    </article></main>
  );
}
