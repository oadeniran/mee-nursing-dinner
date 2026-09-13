import { Db } from "mongodb";
import { getVotingCategories } from "./awards";

// Deterministic anonymous label so the same ballot always shows as the same "Voter #".
// Sorted by createdAt/matric so numbering is stable across page loads.
export async function getPublicResults(db: Db, dept: string) {
  const cats = await getVotingCategories(db, dept);
  const ballots = await db.collection("ballots").find({ dept }).sort({ updatedAt: 1 }).toArray();

  // Reveal flag — defaults OFF. Flip via vote-admin when/if the class votes to de-anonymize.
  const meta = await db.collection("meta").findOne({ _id: `results:${dept}` as never });
  const published = meta?.published === true;
  const revealNames = meta?.revealNames === true;

  // Candidate id -> display name, per category.
  const nameFor: Record<string, Record<string, string>> = {};
  for (const c of cats) {
    nameFor[c.id] = Object.fromEntries(c.candidates.map((x) => [x.id, x.name]));
  }

  // Aggregate tallies.
  const tallies = cats.map((cat) => {
    const counts: Record<string, number> = {};
    for (const c of cat.candidates) counts[c.id] = 0;
    for (const b of ballots) {
      const pick = b.choices?.[cat.id];
      if (pick && pick in counts) counts[pick]++;
    }
    const rows = cat.candidates
      .map((c) => ({ name: c.name, votes: counts[c.id] }))
      .sort((a, b) => b.votes - a.votes);
    return { id: cat.id, title: cat.title, rows, total: rows.reduce((s, r) => s + r.votes, 0) };
  });

  // Per-ballot breakdown — anonymized by default.
  const perBallot = ballots.map((b, i) => ({
    label: revealNames ? (b.voterName ?? `Voter #${i + 1}`) : `Voter #${i + 1}`,
    choices: cats.map((cat) => ({
      category: cat.title,
      pick: b.choices?.[cat.id] ? (nameFor[cat.id]?.[b.choices[cat.id]] ?? "—") : "—",
    })),
  }));

  return { dept, published, revealNames, ballotCount: ballots.length, categories: cats.map((c) => c.title), tallies, perBallot };
}