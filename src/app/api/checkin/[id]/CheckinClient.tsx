"use client";

import { useState } from "react";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "";

export default function CheckinClient(props: {
  orderId: string; sig: string; name: string; plusOneName: string | null;
  dept: string; ticketType: "single" | "plusOne";
  mains: string[]; desserts: string[]; test: boolean;
  alreadyCheckedIn: boolean; checkedInAt: string | null;
}) {
  const [stage, setStage] = useState<"idle" | "sent" | "done">(
    props.alreadyCheckedIn ? "done" : "idle"
  );
  const [already, setAlready] = useState(props.alreadyCheckedIn);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(props.checkedInAt);
  const [emailHint, setEmailHint] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const admitCount = props.ticketType === "plusOne" ? 2 : 1;

  async function sendOtp() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/checkin/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: props.orderId, sig: props.sig }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setAlready(true); setStage("done"); }
        throw new Error(data.error || "Could not send code");
      }
      setEmailHint(data.emailHint || "");
      setStage("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/checkin/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: props.orderId, sig: props.sig, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setAlready(true); setCheckedInAt(data.checkedInAt ?? null); setStage("done"); }
        throw new Error(data.error || "Verification failed");
      }
      setCheckedInAt(data.checkedInAt ?? new Date().toISOString());
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="checkin">
      <div className="checkin-card">
        <div className="ticket-head" style={{ justifyContent: "center" }}>
          <span className="ticket-name">
            {props.name}{props.plusOneName ? ` + ${props.plusOneName}` : ""}
          </span>
        </div>
        <p className="muted">{props.dept}</p>
        <p className="admit-badge">Admits {admitCount} {admitCount === 1 ? "guest" : "guests"}{props.test ? " · TEST" : ""}</p>
        {(props.mains.length > 0 || props.desserts.length > 0) && (
          <p className="muted checkin-menu">
            {props.mains.length > 0 && <>Main: {props.mains.join(", ")}<br /></>}
            {props.desserts.length > 0 && <>Dessert: {props.desserts.join(", ")}</>}
          </p>
        )}
      </div>

      {/* Already checked in — the double-entry warning */}
      {stage === "done" && already && (
        <div className="checkin-alert warn">
          <div className="big">⚠ ALREADY CHECKED IN</div>
          {checkedInAt && <p>at {fmt(checkedInAt)}</p>}
          <p className="muted">Do not admit again without organizer approval.</p>
        </div>
      )}

      {/* Just checked in successfully */}
      {stage === "done" && !already && (
        <div className="checkin-alert ok">
          <div className="big">✓ CHECKED IN</div>
          <p>Admit {admitCount} {admitCount === 1 ? "guest" : "guests"}. Enjoy the night!</p>
        </div>
      )}

      {/* Step 1: send code */}
      {stage === "idle" && (
        <>
          <p className="muted checkin-instr">Tap below to send a one-time code to the guest&apos;s email. Ask them to read it back to you.</p>
          <button className="pay-submit" disabled={busy} onClick={sendOtp} type="button">
            {busy ? "Sending…" : "Send check-in code"}
          </button>
        </>
      )}

      {/* Step 2: enter code */}
      {stage === "sent" && (
        <>
          <p className="muted checkin-instr">Code sent to {emailHint}. Enter what the guest reads out.</p>
          <input
            className="otp-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••" inputMode="numeric" maxLength={6}
          />
          <button className="pay-submit" disabled={code.length !== 6 || busy} onClick={verify} type="button">
            {busy ? "Checking…" : "Confirm check-in"}
          </button>
          <button className="link-btn" disabled={busy} onClick={sendOtp} type="button">Resend code</button>
        </>
      )}

      {error && <p className="pay-error">{error}</p>}
    </div>
  );
}