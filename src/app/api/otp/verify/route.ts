import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashCode, signToken } from "@/lib/security";

const MAX_ATTEMPTS = 5;
const TOKEN_TTL_SECONDS = 15 * 60;

export async function POST(req: Request) {
  try {
    const { email, code, purpose = "payment" } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    const codeStr = String(code || "").trim();

    const db = await getDb();
    const otps = db.collection("otps");
    const doc = await otps.findOne({ email: clean, purpose });

    if (!doc) return NextResponse.json({ error: "Request a code first" }, { status: 400 });
    if (new Date(doc.expiresAt).getTime() < Date.now())
      return NextResponse.json({ error: "Code expired, request a new one" }, { status: 400 });
    if ((doc.attempts ?? 0) >= MAX_ATTEMPTS)
      return NextResponse.json({ error: "Too many attempts, request a new code" }, { status: 429 });

    if (doc.codeHash !== hashCode(codeStr)) {
      await otps.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
    }

    await otps.deleteOne({ _id: doc._id }); // consume it
    const token = signToken({ email: clean, purpose }, TOKEN_TTL_SECONDS);
    return NextResponse.json({ ok: true, token });
  } catch (e) {
    console.error("otp verify error", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}