"use client";
import Link from "next/link";

import { useState, useEffect, useCallback } from "react";

type Candidate = { id: string; name: string };
type Category = { id: string; title: string; candidates: Candidate[] };

// Deterministic warm colour from a name, for the initials avatar.
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 40 + 25}, 60%, 45%)`; // gold/brown band
}
const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")           // drop anything in brackets
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export default function VoteBallot() {
  const [cats, setCats] = useState<Category[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/vote/ballot");
      const data = await res.json();
      if (res.ok) { setCats(data.categories); setChoices(data.choices || {}); setOpen(data.open); }
      setLoading(false);
    })();
  }, []);

  const pick = (catId: string, candId: string) => {
    setChoices((c) => ({ ...c, [catId]: c[catId] === candId ? "" : candId })); // tap again to unpick
    setDirty(true); setSavedMsg("");
  };

  const save = useCallback(async () => {
    setSaving(true); setSavedMsg("");
    try {
      const res = await fetch("/api/vote/ballot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDirty(false); setSavedMsg(`Saved ${data.saved} vote${data.saved === 1 ? "" : "s"} ✓`);
    } catch (e) { setSavedMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }, [choices]);

  if (loading) return <main className="pay-main"><div className="pay-wrap"><p className="muted">Loading ballot…</p></div></main>;

  const picked = Object.values(choices).filter(Boolean).length;

  return (
    <main className="pay-main vote-main">
      <header className="topbar">
        <span className="brand">Owambe&nbsp;<span className="brand-accent">Dinner</span></span>
        <div className="topbar-actions">
          <Link href="/pay" className="pay-btn">Get Your Ticket</Link>
          <Link href="/sponsorship" className="pay-btn secondary">Sponsor/Partner</Link>
        </div>
      </header>
      <div className="pay-wrap">
        <div className="pay-head">
          <p className="awards-brand">APOTHEOSIS de Me🅒anicos</p>
          <p className="awards-kicker">Class Awards</p>
          <h1>Cast Your <span className="gold-text">Votes</span></h1>
          <p className="muted">One pick per category. Tap a name to select, tap again to clear. You can change until voting closes.</p>
        </div>

        <div className="vote-info-note">
          Are you a nominee and want your name displayed differently? Reach out to <strong>Owolabi</strong> to have it changed. First Name+ Last Name is what will be on final awards. If you win but have not paid for dinner by the deadline for ticket payment <strong>1 week before dinner</strong>, then the award is passed to next nominnee that is present. Voting closes at <strong>11:59pm on 7th of September</strong> and results will be announced at the dinner.
        </div>

        {!open && <div className="mee-note"><strong>Voting is closed.</strong> Your saved votes are final — thanks for participating.</div>}

        {cats.map((cat) => (
          <div className="vote-cat" key={cat.id}>
            <h3 className="vote-cat-title">{cat.title}</h3>
            <div className="vote-options">
              {cat.candidates.map((c) => {
                const active = choices[cat.id] === c.id;
                return (
                  <button key={c.id} type="button" disabled={!open}
                    className={`vote-option ${active ? "active" : ""}`} onClick={() => pick(cat.id, c.id)}>
                    <span className="vote-avatar" style={{ backgroundColor: colorFor(c.name) }}>
                      <img src={`/awards/${c.id}.jpg`} alt=""
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      <span className="vote-initials">{initials(c.name)}</span>
                    </span>
                    <span className="vote-name">{c.name}</span>
                    {active && <span className="vote-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky save bar */}
      {open && (
        <div className="vote-savebar">
          <span className="vote-count">{picked} / {cats.length} picked</span>
          <div className="vote-save-right">
            {savedMsg && <span className="vote-saved">{savedMsg}</span>}
            <button className="pay-submit" disabled={saving || !dirty} onClick={save} type="button">
              {saving ? "Saving…" : dirty ? "Save votes" : "Saved"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}