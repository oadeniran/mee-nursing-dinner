"use client";

import { useState } from "react";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "";

export default function CheckinClient(props: {
  orderId: string; sig: string; name: string; plusOneName: string | null;
  dept: string; ticketType: "single" | "plusOne";
  mains: string[]; desserts: string[]; test: boolean;
  alreadyCheckedIn: boolean; checkedInAt: string | null;
  tableNumber: number | null;
}) {
  const [stage, setStage] = useState<"idle" | "sent" | "verified" | "done">(
    props.alreadyCheckedIn ? "done" : "idle"
  );
  const [already, setAlready] = useState(props.alreadyCheckedIn);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(props.checkedInAt);
  const [tableNumber, setTableNumber] = useState<number | null>(props.tableNumber);
  const [emailHint, setEmailHint] = useState("");
  const [code, setCode] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
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
      setCode(""); setStage("sent");
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
      setConfirmToken(data.confirmToken);
      setStage("verified");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/checkin/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: props.orderId, sig: props.sig, confirmToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setAlready(true); setCheckedInAt(data.checkedInAt ?? null); setTableNumber(data.tableNumber ?? null); setStage("done"); }
        else if (data.needsReverify) { setStage("sent"); } // token expired — re-enter code
        throw new Error(data.error || "Check-in failed");
      }
      setCheckedInAt(data.checkedInAt ?? new Date().toISOString());
      setTableNumber(data.tableNumber ?? null);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally { setBusy(false); }
  }

  const TableLine = () =>
    tableNumber != null ? (
      <div className="table-badge">Table {tableNumber}</div>
    ) : (
      <div className="table-badge muted-table">No table assigned yet — seat at any open table</div>
    );

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

      {/* Already checked in */}
      {stage === "done" && already && (
        <div className="checkin-alert warn">
          <div className="big">⚠ ALREADY CHECKED IN</div>
          {checkedInAt && <p>at {fmt(checkedInAt)}</p>}
          <TableLine />
          <p className="muted">Do not admit again without organizer approval.</p>
        </div>
      )}

      {/* Just checked in */}
      {stage === "done" && !already && (
        <div className="checkin-alert ok">
          <div className="big">✓ CHECKED IN</div>
          <TableLine />
          <p>Admit {admitCount} {admitCount === 1 ? "guest" : "guests"}. Enjoy the night!</p>
        </div>
      )}

      {/* Step 1: send code */}
      {stage === "idle" && (
        <>
          <p className="muted checkin-instr">Send a one-time code to the guest&apos;s email, then ask them to read it back.</p>
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
            {busy ? "Verifying…" : "Verify code"}
          </button>
          <button className="link-btn" disabled={busy} onClick={sendOtp} type="button">Resend code</button>
        </>
      )}

      {/* Step 3: verified → confirm check-in */}
      {stage === "verified" && (
        <>
          <div className="checkin-alert ok" style={{ marginBottom: "1rem" }}>
            <div className="big">Code verified ✓</div>
            <p>Confirm to check this guest in.</p>
          </div>
          <button className="pay-submit" disabled={busy} onClick={confirm} type="button">
            {busy ? "Checking in…" : `Check in ${admitCount === 2 ? "(2 guests)" : ""}`}
          </button>
        </>
      )}

      {error && <p className="pay-error">{error}</p>}
    </div>
  );
}