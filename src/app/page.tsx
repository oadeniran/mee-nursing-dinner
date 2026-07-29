import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

// Read every image in /public/images at render time — no hardcoded names.
function getGalleryImages(): string[] {
  const dir = path.join(process.cwd(), "public", "images");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => `/images/${f}`);
  } catch {
    return [];
  }
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
        <Link href="/pay" className="pay-btn">
          Get Your Ticket
        </Link>
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
          <h1 className="hero-title gold-text">[ Placeholder Theme ]</h1>
          <p className="hero-subtheme">[ Placeholder Sub-theme ]</p>
          <p className="hero-desc">A Night of Good Food &amp; Owambe Vibes</p>

          <div className="hero-meta">
            <span>📅 September 18, 2026</span>
            <span>📍 Ifeloju, OAU Campus</span>
          </div>

          <div className="timeline">
            <div>
              <strong>8:00 PM</strong>
              <span>Red Carpet</span>
            </div>
            <div>
              <strong>9:00 PM</strong>
              <span>360 Camera</span>
            </div>
            <div>
              <strong>11:00 PM</strong>
              <span>Main Event</span>
            </div>
          </div>

          <Link href="/pay" className="cta">
            Reserve My Seat
          </Link>
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
              <h3>Main Course</h3>
              <ul>
                <li>Ofada Rice</li>
                <li>Pounded Yam</li>
                <li>Jollof + Fried</li>
              </ul>
              <p className="pick-note">Pick one — you&apos;ll choose at checkout.</p>
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
        <Scatter imgs={pick(5, 10)} />
        <div className="wrap reveal">
          <p className="eyebrow">The Vibe</p>
          <h2 className="section-title">
            Non-stop <span className="gold-text">Fun</span>
          </h2>
          <div className="features">
            <div className="feature">
              <h4>🎉 Owambe Energy</h4>
              <p>Music, colours, and the kind of turn-up only we know how to do.</p>
            </div>
            <div className="feature">
              <h4>📸 360 &amp; Red Carpet</h4>
              <p>Come camera-ready — gold and brown looks amazing on film.</p>
            </div>
            <div className="feature">
              <h4>🤝 Great Company</h4>
              <p>Your department, your people, and a few new faces to meet.</p>
            </div>
            <div className="feature">
              <h4>🍽️ The Food</h4>
              <p>Three courses. Zero regrets. You&apos;ll want seconds.</p>
            </div>
            <div className="feature">
              <h4>After Party</h4>
              <p>Vibez on Vibez till the early hours.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <footer className="footer">
        <p>Seats are limited — lock yours in before we sell out.</p>
        <Link href="/pay" className="cta">
          Pay for Your Ticket
        </Link>
      </footer>
    </main>
  );
}