import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { hashCode, verifyId, signToken } from "@/lib/security";

const MAX_ATTEMPTS = 5;
const CONFIRM_TTL = 10 * 60; // seconds the usher has to hit "Check in" after verifying

export async function POST(req: Request) {
  try {
    const { orderId, sig, code } = await req.json();
    if (!orderId || !verifyId(String(orderId), String(sig)))
      return NextResponse.json({ error: "Invalid or tampered ticket" }, { status: 403 });

    const db = await getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let order: any;
    try {
      order = await db.collection("orders").findOne({ _id: new ObjectId(String(orderId)) });
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

    // Short-lived proof this order's code was verified — the confirm step requires it.
    const confirmToken = signToken({ orderId: String(orderId), purpose: "checkin-confirm" }, CONFIRM_TTL);
    return NextResponse.json({ ok: true, confirmToken });
  } catch (e) {
    console.error("checkin verify error", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}