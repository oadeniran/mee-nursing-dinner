import Link from "next/link";

// wa.me needs digits only — no +, spaces, or dashes.
const wa = (number: string, text: string) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

export default function SponsorshipPage() {
  return (
    <main className="sponsor-main">
      <header className="topbar">
        <span className="brand">Owambe&nbsp;<span className="brand-accent">Dinner</span></span>
        <div className="topbar-actions">
          <Link href="/" className="pay-btn secondary">← Event</Link>
          <Link href="/pay" className="pay-btn">Get Your Ticket</Link>
        </div>
      </header>

      <div className="sponsor-intro">
        <p className="eyebrow">Partner With Us</p>
        <h1 className="section-title">Sponsorship &amp; <span className="gold-text">Ads</span></h1>
        <p className="sponsor-sub">Put your brand in front of the room. Two ways to get involved.</p>
      </div>

      <div className="sponsor-split">
        {/* Red-carpet ad */}
        <section className="sponsor-side sponsor-gold">
          <div className="sponsor-inner">
            <span className="sponsor-tag">Red Carpet Ad</span>
            <h2>Your Logo on the Backdrop</h2>
            <p>
              Get your brand featured on the red-carpet backdrop — seen by every guest, and in every
              photo and 360 video from the night.
            </p>
            <p className="sponsor-price">₦5,000</p>
            <p className="sponsor-fine">per logo placement</p>
            
            <a className="sponsor-btn dark"
              href={wa("2348169147491", "Hi! I'd like to feature my brand logo on the Owambe Dinner red-carpet backdrop.")}
              target="_blank" rel="noopener noreferrer"
            >
              <WhatsAppIcon /> Reserve a spot
            </a>
          </div>
        </section>

        {/* General partnership */}
        <section className="sponsor-side sponsor-brown">
          <div className="sponsor-inner">
            <span className="sponsor-tag light">Partnership</span>
            <h2>Other Sponsorships</h2>
            <p>
              Interested in a bigger partnership or a different kind of collaboration? Reach out to
              either department and let&apos;s talk.
            </p>
            <div className="sponsor-contacts">
              
              <a className="sponsor-btn light"
                href={wa("2348144468185", "Hi Zee! I'm interested in partnering with the Owambe Dinner (Nursing).")}
                target="_blank" rel="noopener noreferrer"
              >
                <WhatsAppIcon /> Nursing — Zee
              </a>
              
              <a className="sponsor-btn light"
                href={wa("2348097219648", "Hi! I'm interested in partnering with the Owambe Dinner (Mechanical Eng).")}
                target="_blank" rel="noopener noreferrer"
              >
                <WhatsAppIcon /> Mechanical Eng - Owolabi
              </a>
            </div>
          </div>
        </section>
      </div>

      <footer className="footer">
        <Link href="/" className="muted">← Back to event</Link>
      </footer>
    </main>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.26-.1-.46-.15-.65.15-.2.3-.75.94-.92 1.13-.17.2-.34.22-.63.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.34.44-.5.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.65-1.57-.9-2.15-.24-.56-.48-.48-.65-.5h-.56c-.2 0-.5.07-.77.37-.26.3-1 .98-1 2.4 0 1.4 1.02 2.76 1.17 2.96.15.2 2.02 3.08 4.9 4.32.68.3 1.22.47 1.63.6.68.22 1.31.19 1.8.11.55-.08 1.7-.7 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.56-.34zM12 2a10 10 0 0 0-8.6 15.06L2 22l5.05-1.32A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3 .78.8-2.92-.2-.3A8.2 8.2 0 1 1 12 20.2z"/>
    </svg>
  );
}