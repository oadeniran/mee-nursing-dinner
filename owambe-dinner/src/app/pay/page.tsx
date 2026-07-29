"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DEPARTMENTS,
  MAIN_COURSES,
  DESSERTS,
  totalAmount,
  ticketPrice,
  FEE,
  type Dept,
  type TicketType,
} from "@/lib/config";

type Menu = { name: string; mainCourse: string; dessert: string };
const emptyMenu = (): Menu => ({ name: "", mainCourse: "", dessert: "" });
const naira = (n: number) => "₦" + n.toLocaleString();

export default function PayPage() {
  const [dept, setDept] = useState<Dept | null>(null);
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [matricNo, setMatricNo] = useState("");
  const [attendee, setAttendee] = useState<Menu>(emptyMenu());
  const [plusOne, setPlusOne] = useState<Menu>(emptyMenu());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsPlus = ticketType === "plusOne";
  const menuOk = (m: Menu) => m.name.trim() && m.mainCourse && m.dessert;
  const canPay =
    !!dept &&
    !!ticketType &&
    matricNo.trim() &&
    menuOk(attendee) &&
    (!needsPlus || menuOk(plusOne)) &&
    !loading;

  async function handlePay() {
    if (!canPay || !dept || !ticketType) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dept,
          ticketType,
          matricNo,
          attendee,
          plusOne: needsPlus ? plusOne : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.checkoutUrl; // hand off to payment
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
              <button
                key={key}
                className={`opt ${dept === key ? "active" : ""}`}
                onClick={() => setDept(key)}
                type="button"
              >
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
                <button
                  key={t}
                  className={`opt ${ticketType === t ? "active" : ""}`}
                  onClick={() => setTicketType(t)}
                  type="button"
                >
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
          </div>
        )}

        {/* 4. Plus-one name (name only) */}
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
            {needsPlus && (
              <MenuPicker who={plusOne.name || "Plus one"} value={plusOne} onChange={setPlusOne} />
            )}
          </div>
        )}

        {/* 6. Summary + pay */}
        {dept && ticketType && (
          <div className="summary">
            <div className="summary-row"><span>Ticket ({ticketType === "single" ? "Solo" : "Plus One"})</span><span>{naira(ticketPrice(dept, ticketType))}</span></div>
            <div className="summary-row"><span>Charge fee</span><span>{naira(FEE)}</span></div>
            <div className="summary-total"><span>Total</span><span>{naira(totalAmount(dept, ticketType))}</span></div>
            <button className="pay-submit" disabled={!canPay} onClick={handlePay} type="button">
              {loading ? "Redirecting to payment…" : `Pay ${naira(totalAmount(dept, ticketType))}`}
            </button>
            {error && <p className="pay-error">{error}</p>}
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