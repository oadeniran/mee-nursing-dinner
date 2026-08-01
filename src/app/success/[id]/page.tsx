import Link from "next/link";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { checkAndSyncStatus } from "@/lib/status";
import { generateQrDataUrl } from "@/lib/qr";

export default async function SuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: any = null;
  let status: string | null = null;
  let qr: string | null = null;

  try {
    const db = await getDb();
    order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
    if (order) {
      status = await checkAndSyncStatus(db, order);
      if (status === "successful") qr = await generateQrDataUrl(id);
    }
  } catch {
    order = null;
  }

  return (
    <main className="pay-main">
      <div className="pay-wrap" style={{ textAlign: "center" }}>
        {!order ? (
          <>
            <h1 className="result-title">Order not found</h1>
            <p className="muted">If you were charged, keep your reference and reach out.</p>
          </>
        ) : status === "successful" ? (
          <>
            <h1 className="result-title">Payment <span className="gold-text">Received</span> 🎉{order.test ? " (TEST)" : ""}</h1>
            <p className="muted">Thanks, {order.attendee?.name}. Show this QR at the door on September 18.</p>
            {qr && (
              <div className="qr-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Your check-in QR code" width={280} height={280} />
                <a className="pay-submit ghost" href={qr} download={`owambe-ticket-${id}.png`}>Download QR</a>
              </div>
            )}
            <p className="muted" style={{ marginTop: "1.5rem" }}>
              Lost this page? Retrieve it anytime at <Link href="/verify" className="gold-text">/verify</Link> with your email.
            </p>
          </>
        ) : status === "failed" ? (
          <>
            <h1 className="result-title">Payment failed</h1>
            <p className="muted">No worries — you can try again.</p>
            <p style={{ marginTop: "1.5rem" }}><Link href="/pay" className="cta">Try again</Link></p>
          </>
        ) : (
          <>
            <h1 className="result-title">Payment pending</h1>
            <p className="muted">We haven&apos;t confirmed your payment yet. If you just paid, give it a moment and re-check.</p>
            <p style={{ marginTop: "1.5rem" }}><Link href="/verify" className="cta">Check status</Link></p>
          </>
        )}
        <p style={{ marginTop: "2rem" }}><Link href="/" className="muted">← Back to event</Link></p>
      </div>
    </main>
  );
}