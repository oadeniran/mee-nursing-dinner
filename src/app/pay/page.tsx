"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DEPARTMENTS, MAIN_COURSES, DESSERTS,
  totalAmount, ticketPrice, FEE,
  type Dept, type TicketType,
} from "@/lib/config";

type Menu = { name: string; mainCourse: string; dessert: string };
const emptyMenu = (): Menu => ({ name: "", mainCourse: "", dessert: "" });
const naira = (n: number) => "₦" + n.toLocaleString();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PayPage() {
  const [dept, setDept] = useState<Dept | null>(null);
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [matricNo, setMatricNo] = useState("");
  const [email, setEmail] = useState("");
  const [attendee, setAttendee] = useState<Menu>(emptyMenu());
  const [plusOne, setPlusOne] = useState<Menu>(emptyMenu());

  const [testCode, setTestCode] = useState("");
  const [showTest, setShowTest] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [token, setToken] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsPlus = ticketType === "plusOne";
  const menuOk = (m: Menu) => m.name.trim() && m.mainCourse && m.dessert;
  const emailOk = EMAIL_RE.test(email.trim());
  const formOk =
    !!dept && !!ticketType && !!matricNo.trim() && emailOk &&
    menuOk(attendee) && (!needsPlus || menuOk(plusOne));
  const canPay = formOk && otpVerified && !loading;

  // Changing the email invalidates any prior verification.
  useEffect(() => {
    setOtpVerified(false); setOtpSent(false);
    setToken(""); setOtpCode(""); setOtpError("");
  }, [email]);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("resumeOrder");
      if (!raw) return;
      sessionStorage.removeItem("resumeOrder");
      const r = JSON.parse(raw);
      if (r.dept) setDept(r.dept);
      if (r.ticketType) setTicketType(r.ticketType);
      if (r.matricNo) setMatricNo(r.matricNo);
      if (r.attendee) setAttendee(r.attendee);
      if (r.plusOne) setPlusOne(r.plusOne);
      if (r.email) setEmail(r.email); // last, so the OTP-reset effect runs clean
    } catch {}
  }, []);

  async function sendOtp() {
    setOtpBusy(true); setOtpError("");
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), purpose: "payment" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send code");
      setOtpSent(true); setCooldown(60);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Could not send code");
    } finally { setOtpBusy(false); }
  }

  async function verifyOtp() {
    setOtpBusy(true); setOtpError("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim(), purpose: "payment" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setToken(data.token); setOtpVerified(true);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Verification failed");
    } finally { setOtpBusy(false); }
  }

  async function handlePay(useTest = false) {
    if (!dept || !ticketType || loading) return;
    if (!useTest && !canPay) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dept, ticketType, matricNo, email: email.trim(),
          attendee, plusOne: needsPlus ? plusOne : null, token,
          testCode: useTest ? testCode.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.redirectUrl || data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="pay-main">
      <div className="pay-wrap">
        <div className="pay-head">
          <Link href="/" className="muted">← Back to event</Link>
          <h1>Get Your <span className="gold-text">Ticket</span></h1>
        </div>

        {/* 1. Department */}
        <div className="step">
          <span className="step-label">Which department are you from?</span>
          <div className="opt-grid">
            {(Object.keys(DEPARTMENTS) as Dept[]).map((key) => (
              <button key={key} type="button" className={`opt ${dept === key ? "active" : ""}`} onClick={() => setDept(key)}>
                <div className="opt-title">{DEPARTMENTS[key].label}</div>
                <div className="muted">{DEPARTMENTS[key].org}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Ticket type */}
        {dept && (
          <div className="step">
            <span className="step-label">Are you paying solo or for a plus one?</span>
            <div className="opt-grid">
              {(["single", "plusOne"] as TicketType[]).map((t) => (
                <button key={t} type="button" className={`opt ${ticketType === t ? "active" : ""}`} onClick={() => setTicketType(t)}>
                  <div className="opt-title">{t === "single" ? "Solo" : "Plus One"}</div>
                  <div className="opt-price">{naira(ticketPrice(dept, t))}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Your details */}
        {ticketType && (
          <div className="step">
            <span className="step-label">Your details</span>
            <div className="field">
              <label>Matric No.</label>
              <input value={matricNo} onChange={(e) => setMatricNo(e.target.value)} placeholder="e.g. NUR/2021/001" />
            </div>
            <div className="field">
              <label>Full Name</label>
              <input value={attendee.name} onChange={(e) => setAttendee({ ...attendee, name: e.target.value })} placeholder="Your name" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <span className="field-hint">Your ticket &amp; QR code will be tied to this email.</span>
            </div>
          </div>
        )}

        {/* 4. Plus-one name */}
        {needsPlus && (
          <div className="step">
            <span className="step-label">Your plus one</span>
            <div className="field">
              <label>Plus One&apos;s Name</label>
              <input value={plusOne.name} onChange={(e) => setPlusOne({ ...plusOne, name: e.target.value })} placeholder="Their name" />
            </div>
          </div>
        )}

        {/* 5. Menu */}
        {ticketType && (
          <div className="step">
            <span className="step-label">Menu selection</span>
            <MenuPicker who={attendee.name || "You"} value={attendee} onChange={setAttendee} />
            {needsPlus && <MenuPicker who={plusOne.name || "Plus one"} value={plusOne} onChange={setPlusOne} />}
          </div>
        )}

        {/* 6. Summary + verify + pay */}
        {dept && ticketType && (
          <div className="summary">
            <div className="summary-row"><span>Ticket ({ticketType === "single" ? "Solo" : "Plus One"})</span><span>{naira(ticketPrice(dept, ticketType))}</span></div>
            <div className="summary-row"><span>Charge fee</span><span>{naira(FEE)}</span></div>
            <div className="summary-total"><span>Total</span><span>{naira(totalAmount(dept, ticketType))}</span></div>

            {!otpVerified ? (
              <div className="otp-gate">
                {!otpSent ? (
                  <>
                    <p className="otp-hint">Verify your email to unlock payment.</p>
                    <button className="pay-submit ghost" disabled={!emailOk || otpBusy} onClick={sendOtp} type="button">
                      {otpBusy ? "Sending…" : "Send verification code"}
                    </button>
                    {!emailOk && <p className="otp-note">Enter a valid email in your details first.</p>}
                  </>
                ) : (
                  <>
                    <p className="otp-hint">Enter the 6-digit code sent to {email.trim()}.</p>
                    <input
                      className="otp-input"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      inputMode="numeric"
                      maxLength={6}
                    />
                    <button className="pay-submit" disabled={otpCode.length !== 6 || otpBusy} onClick={verifyOtp} type="button">
                      {otpBusy ? "Verifying…" : "Verify code"}
                    </button>
                    <button className="link-btn" disabled={cooldown > 0 || otpBusy} onClick={sendOtp} type="button">
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                    </button>
                  </>
                )}
                {otpError && <p className="pay-error">{otpError}</p>}
              </div>
            ) : (
              <>
                <p className="verified-badge">✓ Email verified</p>
                <button className="pay-submit" disabled={!canPay} onClick={() => handlePay(false)} type="button">
                  {loading ? "Redirecting to payment…" : `Pay ${naira(totalAmount(dept, ticketType))}`}
                </button>
                {!formOk && <p className="otp-note">Finish all fields above to continue.</p>}
                {error && <p className="pay-error">{error}</p>}

                <button className="link-btn" type="button" onClick={() => setShowTest((s) => !s)}>
                  {showTest ? "Hide test option" : "Organizer? Use a test code"}
                </button>
                {showTest && (
                  <div className="test-box">
                    <input
                      value={testCode}
                      onChange={(e) => setTestCode(e.target.value)}
                      placeholder="Test code"
                    />
                    <button
                      className="pay-submit ghost"
                      disabled={!formOk || !testCode.trim() || loading}
                      onClick={() => handlePay(true)}
                      type="button"
                    >
                      Skip payment (test)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function MenuPicker({ who, value, onChange }: { who: string; value: Menu; onChange: (m: Menu) => void }) {
  return (
    <div className="menu-block">
      <h4>{who}</h4>
      <p className="menu-sub">Main course</p>
      <div className="radio-row">
        {MAIN_COURSES.map((m) => (
          <button key={m} type="button" className={`radio-pill ${value.mainCourse === m ? "active" : ""}`} onClick={() => onChange({ ...value, mainCourse: m })}>{m}</button>
        ))}
      </div>
      <p className="menu-sub">Dessert</p>
      <div className="radio-row">
        {DESSERTS.map((d) => (
          <button key={d} type="button" className={`radio-pill ${value.dessert === d ? "active" : ""}`} onClick={() => onChange({ ...value, dessert: d })}>{d}</button>
        ))}
      </div>
    </div>
  );
}