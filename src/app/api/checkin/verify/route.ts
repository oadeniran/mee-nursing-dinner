import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { hashCode, verifyId } from "@/lib/security";

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const { orderId, sig, code } = await req.json();
    if (!orderId || !verifyId(String(orderId), String(sig)))
      return NextResponse.json({ error: "Invalid or tampered ticket" }, { status: 403 });

    const db = await getDb();
    const orders = db.collection("orders");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let order: any;
    try {
      order = await orders.findOne({ _id: new ObjectId(String(orderId)) });
    } catch {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!order) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (order.checkedIn)
      return NextResponse.json({ error: "Already checked in", checkedInAt: order.checkedInAt }, { status: 409 });

    const otps = db.collection("otps");
    const doc = await otps.findOne({ email: order.email, purpose: "checkin" });
    if (!doc) return NextResponse.json({ error: "Send a code first" }, { status: 400 });
    if (new Date(doc.expiresAt).getTime() < Date.now())
      return NextResponse.json({ error: "Code expired, resend" }, { status: 400 });
    if ((doc.attempts ?? 0) >= MAX_ATTEMPTS)
      return NextResponse.json({ error: "Too many attempts, resend a code" }, { status: 429 });

    if (doc.codeHash !== hashCode(String(code || "").trim())) {
      await otps.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
    }

    await otps.deleteOne({ _id: doc._id });

    // Atomic check-in: only flips if not already checked in — the double-entry guard.
    const checkedInAt = new Date();
    const result = await orders.updateOne(
      { _id: order._id, checkedIn: { $ne: true } },
      { $set: { checkedIn: true, checkedInAt } }
    );
    if (result.modifiedCount === 0)
      return NextResponse.json({ error: "Already checked in" }, { status: 409 });

    return NextResponse.json({ ok: true, checkedInAt });
  } catch (e) {
    console.error("checkin verify error", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}