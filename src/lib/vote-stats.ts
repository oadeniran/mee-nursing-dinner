import { Db } from "mongodb";
import { getVotingCategories, categoriesFor, slugify, AWARD_CATEGORIES } from "./awards";

export async function getVoteStats(db: Db, dept: string) {
  const cats = await getVotingCategories(db, dept);
  const ballots = await db.collection("ballots").find({ dept }).toArray();
  const voterCount = await db.collection("voters").countDocuments({ dept });

  const tallies = cats.map((cat) => {
    const counts: Record<string, number> = {};
    for (const c of cat.candidates) counts[c.id] = 0;
    for (const b of ballots) {
      const pick = b.choices?.[cat.id];
      if (pick && pick in counts) counts[pick]++;
    }
    const rows = cat.candidates
      .map((c) => ({ id: c.id, name: c.name, votes: counts[c.id] }))
      .sort((a, b) => b.votes - a.votes);
    const total = rows.reduce((s, r) => s + r.votes, 0);
    return { id: cat.id, title: cat.title, rows, total };
  });

  const meta = await db.collection("meta").findOne({ _id: `voting:${dept}` as never });

  return {
    dept,
    open: meta?.open === true,
    ballotsCast: ballots.length,
    voterCount,
    tallies,
  };
}

// Live candidate list per category (seed overlaid with DB edits), for the manage UI.
export async function getManageCategories(db: Db, dept: string) {
  const overrides = await db.collection("award_config").find({ dept }).toArray();
  const byId = new Map(overrides.map((o) => [o.id, o]));
  return categoriesFor(dept).map((c) => {
    const ov = byId.get(c.id);
    return {
      id: c.id,
      title: c.title,
      enabled: ov?.enabled ?? c.enabled,
      candidates: (ov?.candidates ?? c.candidates) as string[],
    };
  });
}

// Add/remove a candidate name in a category (writes to the override doc).
export async function editCandidate(db: Db, dept: string, catId: string, name: string, action: "add" | "remove") {
  const seed = AWARD_CATEGORIES.find((c) => c.id === catId && c.dept === dept);
  if (!seed) throw new Error("Unknown category");

  const ov = await db.collection("award_config").findOne({ dept, id: catId });
  const current: string[] = ov?.candidates ?? seed.candidates;
  const clean = name.trim();
  if (!clean) throw new Error("Empty name");

  let next: string[];
  if (action === "add") {
    if (current.some((n) => slugify(n) === slugify(clean))) return current; // dedupe by slug
    next = [...current, clean];
  } else {
    next = current.filter((n) => slugify(n) !== slugify(clean));
  }

  await db.collection("award_config").updateOne(
    { dept, id: catId },
    { $set: { dept, id: catId, candidates: next } },
    { upsert: true }
  );
  return next;
}

export async function setCategoryEnabled(db: Db, dept: string, catId: string, enabled: boolean) {
  const seed = AWARD_CATEGORIES.find((c) => c.id === catId && c.dept === dept);
  if (!seed) throw new Error("Unknown category");
  await db.collection("award_config").updateOne(
    { dept, id: catId },
    { $set: { dept, id: catId, enabled, candidates: seed.candidates } }, // seed candidates if first touch
    { upsert: true }
  );
}