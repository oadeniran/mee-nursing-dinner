"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DEPARTMENTS, MAIN_COURSES, DESSERTS,
  totalAmount, ticketPrice, feeFor, MAX_SEATING_REQUESTS,
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

  const [payNow, setPayNow] = useState<string>(""); // blank = pay full

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [token, setToken] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [mode, setMode] = useState<"choose" | "new" | "resume">("choose");
  const [resumeEmail, setResumeEmail] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [isResume, setIsResume] = useState(false);
  const [ledger, setLedger] = useState<{ amountDue: number; totalPaid: number; remaining: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  type SeatReq = { label: string; value: string };
  const [seating, setSeating] = useState<SeatReq[]>([{ label: "", value: "" }]);

  const updateSeat = (i: number, field: keyof SeatReq, v: string) =>
    setSeating((s) => s.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
  const addSeat = () =>
    setSeating((s) => (s.length < MAX_SEATING_REQUESTS ? [...s, { label: "", value: "" }] : s));
  const removeSeat = (i: number) =>
    setSeating((s) => (s.length > 1 ? s.filter((_, idx) => idx !== i) : s));

   // Only rows where the guest typed an identifier get sent.
  const cleanedSeating = seating
    .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
    .filter((r) => r.value !== "");

  const needsPlus = ticketType === "plusOne";
  const menuOk = (m: Menu) => m.name.trim() && m.mainCourse && m.dessert;
  const emailOk = EMAIL_RE.test(email.trim());
  const formOk =
    !!dept && !!ticketType && !!matricNo.trim() && emailOk &&
    menuOk(attendee) && (!needsPlus || menuOk(plusOne));
  const canPay = formOk && otpVerified && !loading;
  // What the user will actually pay this round, and the ceiling.
  const maxPayable = dept && ticketType
    ? (isResume && ledger ? ledger.remaining : ticketPrice(dept, ticketType))
    : 0;
  const instalment = payNow.trim() ? Math.min(Number(payNow), maxPayable) : maxPayable;
  const instalmentFee = feeFor(instalment);
  const chargeTotal = instalment + instalmentFee;
  const payTooMuch = payNow.trim() !== "" && Number(payNow) > maxPayable;

  // Changing the email invalidates any prior verification.
  useEffect(() => {
    if (isResume) return; // resume path is pre-authorised server-side
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

   async function continueInstalment() {
    setResumeBusy(true); setResumeError("");
    try {
      const res = await fetch("/api/order-lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resumeEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      const o = data.order;
      // Prefill everything and jump straight to a verified state (no OTP on resume).
      setDept(o.dept); setTicketType(o.ticketType); setMatricNo(o.matricNo);
      setAttendee(o.attendee); setPlusOne(o.plusOne || emptyMenu());
      setEmail(o.email);
      setSeating(o.seatingRequests?.length ? o.seatingRequests : [{ label: "", value: "" }]);
      setLedger({ amountDue: o.amountDue, totalPaid: o.totalPaid, remaining: o.remaining });
      setIsResume(true);
      setOtpVerified(true);   // resume path is pre-authorised server-side
      setMode("resume");
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : "Lookup failed");
    } finally { setResumeBusy(false); }
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
          seatingRequests: cleanedSeating,
          payNow: payNow.trim() ? Number(payNow) : undefined,
          resume: isResume || undefined,
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
          <p className="muted">You can pay in full or in instalments.</p>
        </div>

        {/* Entry chooser */}
        {mode === "choose" && (
          <div className="step">
            <button className="pay-submit" onClick={() => setMode("new")} type="button">Buy a new ticket</button>
            <div className="resume-entry">
              <p className="otp-hint">Already started paying? Continue your instalments:</p>
              <input
                type="email" value={resumeEmail}
                onChange={(e) => setResumeEmail(e.target.value)}
                placeholder="Email you paid with"
              />
              <button className="pay-submit ghost" disabled={resumeBusy || !resumeEmail.trim()} onClick={continueInstalment} type="button">
                {resumeBusy ? "Finding your order…" : "Continue instalment"}
              </button>
              {resumeError && <p className="pay-error">{resumeError}</p>}
            </div>
          </div>
        )}

        {mode !== "choose" && (
          <>
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
                  <input value={matricNo} onChange={(e) => setMatricNo(e.target.value)} placeholder="e.g. NSC/2021/001" />
                </div>
                <div className="field">
                  <label>Full Name</label>
                  <input value={attendee.name} onChange={(e) => setAttendee({ ...attendee, name: e.target.value })} placeholder="Your name" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={isResume} />
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

            {/* MEE + Plus One note */}
            {needsPlus && (
              <div className="mee-note">
                <strong>Heads up:</strong> souvenirs and awards are for {DEPARTMENTS.mee.label} / {DEPARTMENTS.nursing.label} members.
                If your plus one is <em>also </em> a student, they won&apos;t receive a souvenir on a
                plus-one ticket. Therefore we recommend that only non-students be added as plus ones ({DEPARTMENTS.nursing.label} mandates that plus one cannot be a student of the department).
              </div>
            )}

            {/* Seating preference */}
            {ticketType && (
              <div className="step">
                <span className="step-label">Who would you like in close proximity? <span className="optional">(optional)</span></span>
                <p className="seat-hint">
                  We mix departments to help everyone meet new people — but we&apos;ll keep your friends close.
                  Add up to {MAX_SEATING_REQUESTS}. Enter each friend&apos;s email or matric no. (whatever
                  they used to buy their ticket) so we can match you. They must have a ticket too.
                </p>
                {seating.map((row, i) => (
                  <div className="seat-row" key={i}>
                    <input
                      className="seat-name"
                      value={row.label}
                      onChange={(e) => updateSeat(i, "label", e.target.value)}
                      placeholder="Friend's name"
                    />
                    <input
                      className="seat-id"
                      value={row.value}
                      onChange={(e) => updateSeat(i, "value", e.target.value)}
                      placeholder="Their email or matric no."
                    />
                    {seating.length > 1 && (
                      <button type="button" className="seat-remove" onClick={() => removeSeat(i)} aria-label="Remove">×</button>
                    )}
                  </div>
                ))}
                {seating.length < MAX_SEATING_REQUESTS && (
                  <button type="button" className="link-btn seat-add" onClick={addSeat}>+ Add another</button>
                )}
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
                {isResume && ledger ? (
                  <>
                    <div className="summary-row"><span>Total</span><span>{naira(ledger.amountDue)}</span></div>
                    <div className="summary-row"><span>Paid so far</span><span>{naira(ledger.totalPaid)}</span></div>
                    <div className="summary-total"><span>Balance</span><span>{naira(ledger.remaining)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="summary-row"><span>Ticket ({ticketType === "single" ? "Solo" : "Plus One"})</span><span>{naira(ticketPrice(dept, ticketType))}</span></div>
                    <div className="summary-total"><span>Ticket total</span><span>{naira(ticketPrice(dept, ticketType))}</span></div>
                    <p className="fee-note">A transaction fee of 1% (max ₦300) is added on top of each payment. Paying in more instalments means the fee applies to each one.</p>
                  </>
                )}

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
                    {!isResume && <p className="verified-badge">✓ Email verified</p>}

                    {/* Instalment amount — sits ABOVE the pay button and drives its label */}
                    <div className="field paynow-field">
                      <label>Paying in instalments? Enter how much to pay now</label>
                      <div className="paynow-input">
                        <span className="paynow-naira">₦</span>
                        <input
                          type="text" inputMode="numeric"
                          value={payNow ? Number(payNow).toLocaleString() : ""}
                          onChange={(e) => setPayNow(e.target.value.replace(/\D/g, ""))}
                          placeholder={maxPayable.toLocaleString()}
                        />
                      </div>
                      <span className="field-hint">
                        Leave blank to pay {isResume ? "the full balance" : "in full"}. You can pay the rest later from the verify page.
                      </span>
                    </div>

                    {/* Explicit fee breakdown */}
                    <div className="charge-breakdown">
                      <div className="cb-row"><span>{isResume ? "Toward balance" : "Ticket payment"}</span><span>{naira(instalment)}</span></div>
                      <div className="cb-row"><span>Transaction fee (1%, max ₦300)</span><span>+ {naira(instalmentFee)}</span></div>
                      <div className="cb-row cb-total"><span>You&apos;ll be charged</span><span>{naira(chargeTotal)}</span></div>
                    </div>

                    <button className="pay-submit" disabled={!canPay || payTooMuch} onClick={() => handlePay(false)} type="button">
                      {loading ? "Redirecting to payment…" : `Pay ${naira(chargeTotal)}`}
                    </button>
                    {payTooMuch && <p className="pay-error">That&apos;s more than {isResume ? "your balance" : "the ticket"} ({naira(maxPayable)}).</p>}
                    {!formOk && <p className="otp-note">Finish all fields above to continue.</p>}
                    {error && <p className="pay-error">{error}</p>}

                    {!isResume && (
                      <>
                        <button className="link-btn" type="button" onClick={() => setShowTest((s) => !s)}>
                          {showTest ? "Hide test option" : "Organizer? Use a test code"}
                        </button>
                        {showTest && (
                          <div className="test-box">
                            <input value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="Test code" />
                            <button className="pay-submit ghost" disabled={!formOk || !testCode.trim() || loading} onClick={() => handlePay(true)} type="button">
                              Skip payment (test)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MenuPicker({ who, value, onChange }: { who: string; value: Menu; onChange: (m: Menu) => void }) {
  return (
    <div className="menu-block">
      <h4>{who}</h4>
      <p className="menu-sub">Main course <span className="required">*</span></p>
      <div className="radio-row">
        {MAIN_COURSES.map((m) => (
          <button key={m} type="button" className={`radio-pill ${value.mainCourse === m ? "active" : ""}`} onClick={() => onChange({ ...value, mainCourse: m })}>{m}</button>
        ))}
      </div>
      <p className="menu-sub">Dessert <span className="required">*</span></p>
      <div className="radio-row">
        {DESSERTS.map((d) => (
          <button key={d} type="button" className={`radio-pill ${value.dessert === d ? "active" : ""}`} onClick={() => onChange({ ...value, dessert: d })}>{d}</button>
        ))}
      </div>
    </div>
  );
}