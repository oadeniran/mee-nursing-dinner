"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MAIN_COURSES, DESSERTS } from "@/lib/config";

const naira = (n: number) => "₦" + n.toLocaleString();

type Menu = { name: string; mainCourse: string; dessert: string };
type Order = {
  orderId: string; name: string; plusOneName: string | null;
  deptKey: string; deptLabel: string; ticketType: "single" | "plusOne";
  amountDue: number; totalPaid: number; remaining: number; matricNo: string;
  attendee: Menu; plusOne: Menu | null;
  souvenir: boolean; canUpgrade: boolean;
  status: "pending" | "partial" | "successful" | "failed"; test: boolean; qr: string | null;
};

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);

  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [upPlusOne, setUpPlusOne] = useState<Menu>({ name: "", mainCourse: "", dessert: "" });
  const [upBusy, setUpBusy] = useState(false);
  const [upError, setUpError] = useState("");

  async function check() {
    setLoading(true); setError(""); setOrders(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setOrders(data.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  function resume(o: Order) {
    sessionStorage.setItem("resumeOrder", JSON.stringify({
      dept: o.deptKey, ticketType: o.ticketType, matricNo: o.matricNo,
      email: email.trim(), attendee: o.attendee, plusOne: o.plusOne,
    }));
    router.push("/pay?resume=1");
  }

  async function submitUpgrade(o: Order) {
    setUpBusy(true); setUpError("");
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plusOne: upPlusOne }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upgrade failed");
      // Upgraded — now send them to pay the difference via the resume flow.
      sessionStorage.setItem("resumeOrder", JSON.stringify({
        dept: o.deptKey, ticketType: "plusOne", matricNo: o.matricNo,
        email: email.trim(), attendee: o.attendee,
        plusOne: upPlusOne,
      }));
      router.push("/pay?resume=1");
    } catch (e) {
      setUpError(e instanceof Error ? e.message : "Upgrade failed");
    } finally { setUpBusy(false); }
  }

  return (
    <main className="pay-main">
      <div className="pay-wrap">
        <div className="pay-head">
          <Link href="/" className="muted">← Back to event</Link>
          <h1>Verify Your <span className="gold-text">Payment</span></h1>
        </div>

        <div className="field">
          <label>Email used at checkout</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <button className="pay-submit" disabled={loading || !email.trim()} onClick={check} type="button">
          {loading ? "Checking…" : "Check my ticket(s)"}
        </button>
        {error && <p className="pay-error">{error}</p>}

        {orders && orders.length === 0 && (
          <p className="otp-note" style={{ marginTop: "1.5rem" }}>
            No orders found for that email. Double-check it, or <Link href="/pay" className="gold-text">buy a ticket</Link>.
          </p>
        )}

        {orders && orders.map((o) => {
          const paidSome = o.totalPaid > 0 && o.status !== "successful";
          return (
            <div key={o.orderId} className="ticket-card">
              <div className="ticket-head">
                <span className="ticket-name">{o.name}{o.plusOneName ? ` + ${o.plusOneName}` : ""}</span>
                <span className={`status-pill status-${o.status}`}>
                  {o.status === "successful" ? "Paid" : o.status === "partial" ? "Part-paid" : o.status === "failed" ? "Failed" : "Pending"}
                  {o.test ? " · TEST" : ""}
                </span>
              </div>
              <p className="muted">{o.deptLabel} · {o.ticketType === "single" ? "Solo" : "Plus One"}</p>

              {/* Ledger */}
              {o.status !== "successful" && (
                <div className="ledger">
                  <div className="ledger-row"><span>Total</span><span>{naira(o.amountDue)}</span></div>
                  <div className="ledger-row"><span>Paid so far</span><span>{naira(o.totalPaid)}</span></div>
                  <div className="ledger-row balance"><span>Balance left</span><span>{naira(o.remaining)}</span></div>
                  <p className="fee-note">Each payment adds a 1% fee (max ₦300). Fewer, larger payments mean less total fee.</p>
                </div>
              )}

              {o.status === "successful" && o.qr && (
                <div className="qr-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.qr} alt="Check-in QR code" width={260} height={260} />
                  <a className="pay-submit ghost" href={o.qr} download={`owambe-ticket-${o.orderId}.png`}>Download QR</a>
                </div>
              )}

              {(o.status === "partial" || o.status === "pending" || o.status === "failed") && o.remaining > 0 && (
                <>
                  <p className="otp-note">
                    {paidSome
                      ? "Payment received — your ticket unlocks once the balance is cleared."
                      : "Complete your payment to unlock your ticket."}
                  </p>
                  <button className="pay-submit ghost" onClick={() => resume(o)} type="button">
                    {paidSome ? `Pay balance (${naira(o.remaining)})` : "Complete payment"}
                  </button>
                </>
              )}

              {/* Upgrade single → plus one */}
              {o.canUpgrade && (
                <div className="upgrade-block">
                  {upgradingId !== o.orderId ? (
                    <button className="link-btn" type="button" onClick={() => { setUpgradingId(o.orderId); setUpError(""); }}>
                      + Upgrade to Plus One
                    </button>
                  ) : (
                    <div className="upgrade-form">
                      <p className="otp-hint">Add your plus one — you&apos;ll pay the difference next.</p>
                      <input
                        className="up-input"
                        value={upPlusOne.name}
                        onChange={(e) => setUpPlusOne({ ...upPlusOne, name: e.target.value })}
                        placeholder="Plus one's name"
                      />
                      <p className="menu-sub">Main course</p>
                      <div className="radio-row">
                        {MAIN_COURSES.map((m) => (
                          <button key={m} type="button" className={`radio-pill ${upPlusOne.mainCourse === m ? "active" : ""}`}
                            onClick={() => setUpPlusOne({ ...upPlusOne, mainCourse: m })}>{m}</button>
                        ))}
                      </div>
                      <p className="menu-sub">Dessert</p>
                      <div className="radio-row">
                        {DESSERTS.map((d) => (
                          <button key={d} type="button" className={`radio-pill ${upPlusOne.dessert === d ? "active" : ""}`}
                            onClick={() => setUpPlusOne({ ...upPlusOne, dessert: d })}>{d}</button>
                        ))}
                      </div>
                      {upError && <p className="pay-error">{upError}</p>}
                      <div className="upgrade-actions">
                        <button className="pay-submit" disabled={upBusy || !upPlusOne.name.trim() || !upPlusOne.mainCourse || !upPlusOne.dessert}
                          onClick={() => submitUpgrade(o)} type="button">
                          {upBusy ? "Upgrading…" : "Upgrade & pay difference"}
                        </button>
                        <button className="link-btn" type="button" onClick={() => setUpgradingId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}