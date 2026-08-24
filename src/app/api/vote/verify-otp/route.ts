import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashCode } from "@/lib/security";
import { normMatric, createVoterSession } from "@/lib/vote-auth";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000; // 15-min lockout after too many wrong tries

export async function POST(req: Request) {
  try {
    const { matric, code } = await req.json();
    const m = normMatric(matric);
    const db = await getDb();
    const voters = db.collection("voters");
    const voter = await voters.findOne({ matric: m });
    if (!voter) return NextResponse.json({ error: "Unknown matric" }, { status: 404 });
    if (!voter.currentCodeHash) return NextResponse.json({ error: "Request a code first" }, { status: 400 });

    // Locked out?
    if (voter.lockedUntil && new Date(voter.lockedUntil).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(voter.lockedUntil).getTime() - Date.now()) / 60000);
      return NextResponse.json({ error: `Too many wrong tries. Try again in ${mins} min.` }, { status: 429 });
    }

    const correct = voter.currentCodeHash === hashCode(String(code || "").trim());

    if (!correct) {
      const attempts = (voter.failedAttempts ?? 0) + 1;
      const update: Record<string, unknown> = { failedAttempts: attempts };
      let msg = "Incorrect code";
      if (attempts >= MAX_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCK_MS);
        update.failedAttempts = 0; // reset counter; lock is the gate now
        msg = "Too many wrong tries. Locked for 15 minutes.";
      }
      await voters.updateOne({ matric: m }, { $set: update });
      return NextResponse.json({ error: msg }, { status: attempts >= MAX_ATTEMPTS ? 429 : 400 });
    }

    // Success — clear any failure state and start the session.
    await voters.updateOne({ matric: m }, { $set: { failedAttempts: 0, lockedUntil: null } });
    await createVoterSession(m, voter.dept ?? "mee");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("vote verify error", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}