import Link from "next/link";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export default async function SuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order: Record<string, unknown> | null = null;
  try {
    const db = await getDb();
    // Mark paid + log the callback hit. (Driver v6 returns the doc directly.)
    order = await db.collection("orders").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: "paid", callbackHitAt: new Date() } },
      { returnDocument: "after" }
    );
  } catch {
    order = null;
  }

  return (
    <main className="pay-main">
      <div className="pay-wrap" style={{ textAlign: "center" }}>
        {order ? (
          <>
            <h1 className="pay-head" style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem" }}>
              Payment <span className="gold-text">Received</span> 🎉
            </h1>
            <p className="muted">
              Thanks, {String((order as any).attendee?.name ?? "")}. Your seat is locked in — see you September 18.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem" }}>We couldn&apos;t find that order</h1>
            <p className="muted">If you were charged, keep your reference and reach out.</p>
          </>
        )}
        <p style={{ marginTop: "2rem" }}><Link href="/" className="cta">Back to Event</Link></p>
      </div>
    </main>
  );
}