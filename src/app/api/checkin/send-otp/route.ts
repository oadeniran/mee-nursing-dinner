import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { sendCheckinEmail } from "@/lib/email";
import { generateCode, hashCode, verifyId } from "@/lib/security";

const RESEND_COOLDOWN_MS = 30_000;
const CODE_TTL_MS = 10 * 60_000;

export async function POST(req: Request) {
  try {
    const { orderId, sig } = await req.json();
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
    if (order.status !== "successful")
      return NextResponse.json({ error: "This ticket is not paid" }, { status: 402 });
    if (order.checkedIn)
      return NextResponse.json({ error: "Already checked in" }, { status: 409 });

    const purpose = "checkin";
    const email = order.email;
    const otps = db.collection("otps");

    const existing = await otps.findOne({ email, purpose });
    if (existing?.lastSentAt && Date.now() - new Date(existing.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(existing.lastSentAt).getTime())) / 1000);
      return NextResponse.json({ error: `Wait ${wait}s before resending` }, { status: 429 });
    }

    const code = generateCode();
    await otps.updateOne(
      { email, purpose },
      { $set: {
          email, purpose, codeHash: hashCode(code),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
          attempts: 0, lastSentAt: new Date(),
      } },
      { upsert: true }
    );

    await sendCheckinEmail(email, code, order.attendee?.name ?? "");
    // Return a masked email so the usher can confirm it went to the right person.
    return NextResponse.json({ ok: true, emailHint: maskEmail(email) });
  } catch (e) {
    console.error("checkin send-otp error", e);
    return NextResponse.json({ error: "Could not send code" }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [user, domain] = String(email).split("@");
  if (!domain) return "***";
  const shown = user.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}