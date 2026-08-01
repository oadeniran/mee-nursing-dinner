import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { sendOtpEmail } from "@/lib/email";
import { generateCode, hashCode } from "@/lib/security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_MS = 60_000;
const CODE_TTL_MS = 10 * 60_000;

export async function POST(req: Request) {
  try {
    const { email, purpose = "payment" } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

    const db = await getDb();
    const otps = db.collection("otps");

    const existing = await otps.findOne({ email: clean, purpose });
    if (existing?.lastSentAt) {
      const elapsed = Date.now() - new Date(existing.lastSentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json({ error: `Please wait ${wait}s before requesting another code` }, { status: 429 });
      }
    }

    const code = generateCode();
    await otps.updateOne(
      { email: clean, purpose },
      { $set: {
          email: clean, purpose,
          codeHash: hashCode(code),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
          attempts: 0, lastSentAt: new Date(),
      } },
      { upsert: true }
    );

    await sendOtpEmail(clean, code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("otp send error", e);
    return NextResponse.json({ error: "Could not send code, try again" }, { status: 500 });
  }
}