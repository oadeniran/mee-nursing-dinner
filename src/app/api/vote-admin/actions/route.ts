import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { isVoteAdmin } from "@/lib/vote-admin-auth";
import { normMatric } from "@/lib/vote-auth";
import { editCandidate, setCategoryEnabled } from "@/lib/vote-stats";
import { generateCode, hashCode } from "@/lib/security";
import { sendVoteEmail } from "@/lib/email";

export async function POST(req: Request) {
  if (!(await isVoteAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const body = await req.json();
  const { action, dept = "mee" } = body;

  try {
    switch (action) {
      case "toggleVoting": {
        await db.collection("meta").updateOne({ _id: `voting:${dept}` as never }, { $set: { open: body.open === true } }, { upsert: true });
        return NextResponse.json({ ok: true, open: body.open === true });
      }
      case "lookupVoter": {
        const m = normMatric(body.matric);
        const v = await db.collection("voters").findOne({ matric: m });
        if (!v) return NextResponse.json({ error: "Matric not on roster" }, { status: 404 });
        return NextResponse.json({
          name: v.name ?? "", email: v.email ?? "",
          code: v.currentCode ?? null, // plaintext for reading out
          locked: v.lockedUntil ? new Date(v.lockedUntil).getTime() > Date.now() : false,
          hasVoted: !!(await db.collection("ballots").findOne({ matric: m })),
        });
      }
      case "resetVoterCode": {
        const m = normMatric(body.matric);
        const v = await db.collection("voters").findOne({ matric: m });
        if (!v) return NextResponse.json({ error: "Matric not on roster" }, { status: 404 });
        const code = generateCode();
        await db.collection("voters").updateOne({ matric: m },
          { $set: { currentCode: code, currentCodeHash: hashCode(code), failedAttempts: 0, lockedUntil: null, codeIssuedAt: new Date() } });
        if (body.email !== false) { try { await sendVoteEmail(v.email, code, v.name ?? ""); } catch {} }
        return NextResponse.json({ ok: true, code });
      }
      case "unlockVoter": {
        const m = normMatric(body.matric);
        await db.collection("voters").updateOne({ matric: m }, { $set: { failedAttempts: 0, lockedUntil: null } });
        return NextResponse.json({ ok: true });
      }
      case "addCandidate":
        return NextResponse.json({ ok: true, candidates: await editCandidate(db, dept, body.catId, body.name, "add") });
      case "removeCandidate":
        return NextResponse.json({ ok: true, candidates: await editCandidate(db, dept, body.catId, body.name, "remove") });
      case "toggleCategory":
        await setCategoryEnabled(db, dept, body.catId, body.enabled === true);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("vote-admin action error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}