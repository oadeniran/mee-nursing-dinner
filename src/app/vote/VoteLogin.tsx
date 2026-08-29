"use client";

import { useState } from "react";
import Link from "next/link";

export default function VoteLogin() {
  const [matric, setMatric] = useState("");
  const [stage, setStage] = useState<"matric" | "code">("matric");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function getCode(reset = false) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/vote/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matric: matric.trim(), reset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHint(data.emailHint || "");
      setStage("code");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/vote/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matric: matric.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <main className="pay-main">
      <header className="topbar">
        <span className="brand">Owambe&nbsp;<span className="brand-accent">Dinner</span></span>
        <div className="topbar-actions">
          <Link href="/pay" className="pay-btn">Get Your Ticket</Link>
          <Link href="/sponsorship" className="pay-btn secondary">Sponsor/Partner</Link>
        </div>
      </header>
      <div className="pay-wrap" style={{ maxWidth: 440 }}>
        <div className="pay-head">
          <h1>Awards <span className="gold-text">Voting</span></h1>
          <p className="muted">Class members only. Verify to vote.</p>
        </div>

        {stage === "matric" ? (
          <>
            <div className="field">
              <label>Matric Number</label>
              <input value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="MEE/2021/XXX" />
            </div>
            <button className="pay-submit" disabled={busy || !matric.trim()} onClick={() => getCode(false)} type="button">
              {busy ? "Checking…" : "Continue"}
            </button>
          </>
        ) : (
          <>
            <p className="otp-hint">Enter your voting code{hint ? ` (sent to ${hint})` : ""}. It stays the same each time you return.</p>
            <input className="otp-input" value={code} inputMode="numeric" maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" />
            <button className="pay-submit" disabled={busy || code.length !== 6} onClick={verify} type="button">
              {busy ? "Verifying…" : "Enter voting"}
            </button>
            <button className="link-btn" disabled={busy} onClick={() => getCode(true)} type="button">Forgot code? Email me a new one</button>
            <p className="otp-note">No access to your school email? Reach out to Owolabi for your code.</p>
          </>
        )}
        {error && <p className="pay-error">{error}</p>}

        <div className="how-to-vote">
          <h3>How voting works</h3>
          <ol>
            <li><strong>Enter your matric number</strong> — this confirms you&apos;re a class member.</li>
            <li><strong>Get your code.</strong> First time voting? A 6-digit code is sent to your school email. Returning? Use the same code that was emailed to you before.</li>
            <li><strong>No email access?</strong> Reach out to Owolabi and he&apos;ll give you your code.</li>
            <li><strong>Make your picks</strong> — one choice per category. Tap a name to select, tap again to clear if you&apos;d rather skip a category.</li>
            <li><strong>Click Save votes.</strong> Nothing counts until you save.</li>
            <li><strong>Change your mind anytime.</strong> Come back with the same code and update your picks — whatever&apos;s saved when voting closes is final.</li>
          </ol>
          <p className="vote-deadline">⏰ Voting closes at <strong>11:59 PM on 7th September</strong>.</p>
        </div>
      </div>
    </main>
  );
}