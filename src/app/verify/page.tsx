"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const naira = (n: number) => "₦" + n.toLocaleString();

type Menu = { name: string; mainCourse: string; dessert: string };
type Order = {
  orderId: string; name: string; plusOneName: string | null;
  deptKey: string; deptLabel: string; ticketType: "single" | "plusOne";
  amount: number; matricNo: string;
  attendee: Menu; plusOne: Menu | null;
  status: "pending" | "successful" | "failed"; test: boolean; qr: string | null;
};

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);

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

  // Stash the order details and jump to the pay page to finish/retry.
  function resume(o: Order) {
    sessionStorage.setItem("resumeOrder", JSON.stringify({
      dept: o.deptKey,
      ticketType: o.ticketType,
      matricNo: o.matricNo,
      email: email.trim(),
      attendee: o.attendee,
      plusOne: o.plusOne,
    }));
    router.push("/pay?resume=1");
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

        {orders && orders.map((o) => (
          <div key={o.orderId} className="ticket-card">
            <div className="ticket-head">
              <span className="ticket-name">{o.name}{o.plusOneName ? ` + ${o.plusOneName}` : ""}</span>
              <span className={`status-pill status-${o.status}`}>
                {o.status === "successful" ? "Paid" : o.status === "failed" ? "Failed" : "Pending"}
                {o.test ? " · TEST" : ""}
              </span>
            </div>
            <p className="muted">{o.deptLabel} · {o.ticketType === "single" ? "Solo" : "Plus One"} · {naira(o.amount)}</p>

            {o.status === "successful" && o.qr && (
              <div className="qr-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.qr} alt="Check-in QR code" width={260} height={260} />
                <a className="pay-submit ghost" href={o.qr} download={`owambe-ticket-${o.orderId}.png`}>Download QR</a>
              </div>
            )}

            {o.status === "pending" && (
              <>
                <p className="otp-note">Payment not confirmed yet. If you just paid, re-check in a moment — otherwise complete it below.</p>
                <button className="pay-submit ghost" onClick={() => resume(o)} type="button">Complete payment</button>
              </>
            )}

            {o.status === "failed" && (
              <>
                <p className="otp-note">This payment failed.</p>
                <button className="pay-submit ghost" onClick={() => resume(o)} type="button">Retry payment</button>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}