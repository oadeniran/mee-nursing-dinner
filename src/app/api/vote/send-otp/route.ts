import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { sendVoteEmail } from "@/lib/email";
import { generateCode, hashCode } from "@/lib/security";
import { normMatric } from "@/lib/vote-auth";

export async function POST(req: Request) {
  try {
    const { matric, reset } = await req.json();
    const m = normMatric(matric);
    if (!m) return NextResponse.json({ error: "Enter your matric number" }, { status: 400 });

    const db = await getDb();
    const voter = await db.collection("voters").findOne({ matric: m });
    if (!voter) return NextResponse.json({ error: "That matric isn't on the class list. Reach out to Owolabi." }, { status: 404 });

    // If they already have a code and aren't resetting, don't email a new one —
    // their existing code still works. (Resend only on first-time or explicit reset.)
    if (voter.currentCodeHash && !reset) {
      return NextResponse.json({ ok: true, alreadyHasCode: true, emailHint: mask(voter.email) });
    }

    const code = generateCode();
    await db.collection("voters").updateOne(
      { matric: m },
      { $set: { currentCode: code, currentCodeHash: hashCode(code), codeIssuedAt: new Date() } }
    );
    await sendVoteEmail(voter.email, code, voter.name ?? "");
    return NextResponse.json({ ok: true, emailHint: mask(voter.email) });
  } catch (e) {
    console.error("vote code error", e);
    return NextResponse.json({ error: "Could not send code" }, { status: 500 });
  }
}

function mask(email: string) {
  const [u, d] = String(email).split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}