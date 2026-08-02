import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { PartyPopper, Camera, Users, UtensilsCrossed, Sparkles } from "lucide-react";
import HighlightsCarousel from "./HighlightsCarousel";
import Countdown from "./Countdown";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

// Read every image in /public/images at render time — no hardcoded names.
function getGalleryImages(): string[] {
  const dir = path.join(process.cwd(), "public", "images");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
  } catch {
    return [];
  }

  // Natural sort so mee2 comes before mee10 (not "mee10" before "mee2").
  const byNumber = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  const mee = files.filter((f) => f.toLowerCase().startsWith("mee")).sort(byNumber);
  const nur = files.filter((f) => f.toLowerCase().startsWith("nur")).sort(byNumber);
  const other = files
    .filter((f) => !f.toLowerCase().startsWith("mee") && !f.toLowerCase().startsWith("nur"))
    .sort(byNumber);

  // Zip mee/nur together; when one is exhausted, the rest of the longer list follows.
  const zipped: string[] = [];
  const max = Math.max(mee.length, nur.length);
  for (let i = 0; i < max; i++) {
    if (mee[i]) zipped.push(mee[i]);
    if (nur[i]) zipped.push(nur[i]);
  }

  return [...zipped, ...other].map((f) => `/images/${f}`);
}

// Look for a logo file (any common extension) in /public/logos.
function getLogo(name: string): string | null {
  const dir = path.join(process.cwd(), "public", "logos");
  for (const ext of [".png", ".svg", ".jpg", ".jpeg", ".webp"]) {
    const file = path.join(dir, `${name}${ext}`);
    if (fs.existsSync(file)) return `/logos/${name}${ext}`;
  }
  return null;
}

// Decorative photos scattered around a section.
function Scatter({ imgs }: { imgs: string[] }) {
  return (
    <div className="scatter-group">
      {imgs.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className={`scatter s-${(i % 6) + 1}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const images = getGalleryImages();
  const nursingLogo = getLogo("nursing");
  const meeLogo = getLogo("mee");

  // Grab `count` images starting at `offset`, cycling if there aren't enough.
  const pick = (count: number, offset: number): string[] =>
    images.length === 0
      ? []
      : Array.from({ length: count }, (_, i) => images[(offset + i) % images.length]);

  return (
    <main>
      {/* Always-visible pay bar */}
      <header className="topbar">
        <span className="brand">
          Owambe&nbsp;<span className="brand-accent">Dinner</span>
        </span>

        <div className="topbar-actions">
          <Link href="/pay" className="pay-btn">Get Your Ticket</Link>
          <Link href="/verify" className="pay-btn secondary">Verify Payment</Link>
          <Link href="/sponsorship" className="pay-btn">Sponsor/Partnership</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="hero has-scatter">
        <Scatter imgs={pick(4, 0)} />
        <div className="wrap reveal">
          {/* Presenters */}
          <div className="presenters">
            <div className="presenter">
              <div className="logo-badge">
                {nursingLogo ? <img src={nursingLogo} alt="Nursing" /> : <span>Nursing Logo</span>}
              </div>
              <p className="presenter-name">Eximus Curantus</p>
            </div>

            <span className="presenter-x">×</span>

            <div className="presenter">
              <div className="logo-badge">
                {meeLogo ? <img src={meeLogo} alt="MEE" /> : <span>MEE Logo</span>}
              </div>
              <p className="presenter-name">APOTHEOSIS de Me🅒anicos</p>
            </div>
          </div>
          <p className="presents">Presents</p>

          {/* Theme → sub-theme → descriptor */}
          <h1 className="hero-title gold-text">ÀJỌYỌ̀ Royale</h1>
          <p className="hero-desc">A Night of Good Food &amp; Owambe Vibes</p>

          <div className="hero-meta">
            <span>📅 September 18, 2026</span>
            <span>📍 Ifeloju, OAU Campus</span>
          </div>

          <div className="timeline">
            <div>
              <strong>XX:XX PM</strong>
              <span>Red Carpet</span>
            </div>
            <div>
              <strong>XX:XX PM</strong>
              <span>360 Camera</span>
            </div>
            <div>
              <strong>XX:XX PM</strong>
              <span>Main Event</span>
            </div>
          </div>
          <Countdown />
          <Link href="/pay" className="cta">
            Reserve My Seat
          </Link>
        </div>
      </section>

      <section className="has-scatter">
        <Scatter imgs={pick(4, 13)} />
        <div className="wrap reveal">
          <p className="eyebrow">Dress Code</p>
          <h2 className="section-title">
            Come <span className="gold-text">Regal</span>
          </h2>

          <div className="theme-banner">
            <span className="swatch swatch-brown" />
            <span className="swatch swatch-gold" />
            <p>Colour theme — <strong>Brown &amp; Gold</strong></p>
          </div>

          <div className="dresscode">
            <div className="dress-card">
              <h3>The Gentlemen</h3>
              <ul>
                <li><span className="chip chip-gold">Gold</span> Fila (cap)</li>
                <li><span className="chip chip-brown">Brown</span> Attire — Senator preferred, a touch of gold welcome</li>
              </ul>
            </div>

            <div className="dress-card">
              <h3>The Ladies</h3>
              <ul>
                <li><span className="chip chip-gold">Gold</span> Gele</li>
                <li><span className="chip chip-brown">Brown</span> Attire — Lace preferred, a touch of gold welcome</li>
              </ul>
            </div>
          </div>

          <p className="dress-note">Dress to the theme — the 360 camera will thank you.</p>
        </div>
      </section>

      {/* THE 3-COURSE MEAL */}
      <section className="on-cream has-scatter">
        <Scatter imgs={pick(4, 4)} />
        <div className="wrap reveal">
          <p className="eyebrow">The Menu</p>
          <h2 className="section-title">A Full 3-Course Experience</h2>
          <p>From the first bite to the last spoon of dessert — we&apos;ve got you.</p>

          <div className="courses">
            <div className="course-card">
              <span className="course-tag">Course One</span>
              <h3>Appetizer</h3>
              <ul>
                <li>Small Chops</li>
                <li>Chapman</li>
              </ul>
              <p className="pick-note">Served to everyone to start the night.</p>
            </div>

            <div className="course-card">
              <span className="course-tag">Course Two</span>
              <h3>Main Course (Drink + Water Included)</h3>
              <ul>
                <li>Ofada Rice</li>
                <li>Pounded Yam</li>
                <li>Jollof + Fried</li>
              </ul>
              <p className="pick-note">Pick one — you&apos;ll choose at checkout. Protein is Chicken.</p>
            </div>

            <div className="course-card">
              <span className="course-tag">Course Three</span>
              <h3>Dessert</h3>
              <ul>
                <li>Cake Slice</li>
                <li>Parfait</li>
              </ul>
              <p className="pick-note">Pick one — you&apos;ll choose at checkout.</p>
            </div>
          </div>
        </div>
      </section>

      {/* NON-STOP FUN */}
      <section className="has-scatter">
        <Scatter imgs={pick(5, 8)} />
        <div className="wrap reveal">
          <p className="eyebrow">The Vibe</p>
          <h2 className="section-title">
            Non-stop <span className="gold-text">Fun</span>
          </h2>
           <div className="features">
            <div className="feature">
              <Camera className="feature-icon" strokeWidth={1.5} />
              <h4>360 &amp; Red Carpet</h4>
              <p>Come camera-ready — gold and brown looks amazing on film.</p>
            </div>
            <div className="feature">
              <PartyPopper className="feature-icon" strokeWidth={1.5} />
              <h4>Owambe Energy</h4>
              <p>Music, colours, and the kind of turn-up only we know how to do.</p>
            </div>
            <div className="feature">
              <Users className="feature-icon" strokeWidth={1.5} />
              <h4>Great Company</h4>
              <p>Your department, your people, and a few new faces to meet.</p>
            </div>
            <div className="feature">
              <UtensilsCrossed className="feature-icon" strokeWidth={1.5} />
              <h4>The Food</h4>
              <p>Three courses. Zero regrets. You&apos;ll want seconds.</p>
            </div>
            <div className="feature">
              <Sparkles className="feature-icon feature-icon-dance" strokeWidth={1.5} />
              <h4>After Party</h4>
              <p>Vibez on Vibez till the early hours. Props for everyone!</p>
            </div>
          </div>
        </div>
      </section>

      {/* MORE TO EXPERIENCE */}
      <section className="on-cream has-scatter">
        <Scatter imgs={pick(4, 8)} />
        <div className="wrap reveal">
          <p className="eyebrow">On The Night</p>
          <h2 className="section-title">More To <span className="gold-text">Experience</span></h2>
          <HighlightsCarousel />
        </div>
      </section>

      {/* FOOTER CTA */}
       <footer className="footer">
        <p>Seats are limited — lock yours in before we sell out.</p>
        <div className="footer-actions">
          <Link href="/pay" className="cta">Pay for Your Ticket</Link>
          <Link href="/sponsorship" className="cta ghost-cta">Sponsorship / Ads</Link>
          <Link href="/verify" className="cta">Verify Payment</Link>
        </div>
      </footer>
    </main>
  );
}