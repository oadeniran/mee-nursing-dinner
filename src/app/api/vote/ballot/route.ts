import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getVoter } from "@/lib/vote-auth";
import { getVotingCategories, isVotingOpen } from "@/lib/awards";

export async function GET() {
  const voter = await getVoter();
  if (!voter) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = await getDb();
  const [cats, open, ballot] = await Promise.all([
    getVotingCategories(db, voter.dept),
    isVotingOpen(db, voter.dept),
    db.collection("ballots").findOne({ matric: voter.matric }),
  ]);

  return NextResponse.json({ categories: cats, open, choices: ballot?.choices ?? {} });
}

export async function POST(req: Request) {
  const voter = await getVoter();
  if (!voter) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = await getDb();
  if (!(await isVotingOpen(db, voter.dept)))
    return NextResponse.json({ error: "Voting is closed." }, { status: 403 });

  const { choices } = await req.json();
  const cats = await getVotingCategories(db, voter.dept);

  // Validate: every choice must be a real candidate id in an open category.
  const valid: Record<string, string> = {};
  for (const cat of cats) {
    const pick = choices?.[cat.id];
    if (pick && cat.candidates.some((c) => c.id === pick)) valid[cat.id] = pick;
    // blank / abstain allowed — just omit
  }

  await db.collection("ballots").updateOne(
    { matric: voter.matric },
    { $set: { matric: voter.matric, dept: voter.dept, choices: valid, updatedAt: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, saved: Object.keys(valid).length });
}