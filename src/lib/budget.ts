import { Db } from "mongodb";

// Fixed costs — seeded in code so they can't be casually edited in the UI.
// Update these values here as prices finalise.
export const FIXED_ITEMS = [
  { id: "venue",       name: "Venue",            cost: 230000, note: "Ifeloju and Diesel" },
  { id: "mc",          name: "MC",               cost: 70000,  note: "" },
  { id: "dj",          name: "DJ",               cost: 60000,  note: "Sound comes with Live band" },
  { id: "media",       name: "Media",            cost: 50000,  note: "" },
  { id: "videography", name: "Videography",      cost: 80000,  note: "" },
  { id: "backdrop",    name: "Backdrop",         cost: 30000,  note: "Designer payment + printing" },
  { id: "security",    name: "Security",         cost: 30000,  note: "Letter + payment + men on ground" },
  { id: "booth360",    name: "360 Photo Booth",  cost: 70000,  note: "" },
  { id: "liveband",    name: "Live Band",        cost: 230000, note: "Comes with all sound" },
  { id: "decor",       name: "Decorations",      cost: 200000, note: "" },
  { id: "misc",        name: "Miscellaneous / Logistics", cost: 100000, note: "10% of all cost" },
] as const;

// Variable — depend on final headcount, tracked but excluded from settle-up until finalised.
export const VARIABLE_ITEMS = [
  { id: "food",       name: "Food (3-course, drinks, water)", estimate: 1200000, note: "Awaiting per-plate × headcount" },
  { id: "afterparty", name: "After-party props",             estimate: 100000,  note: "Awaiting price per person" },
] as const;

export const TOTAL_FIXED = FIXED_ITEMS.reduce((s, i) => s + i.cost, 0);

// Reads which fixed items have been catered (paid by both depts). Stored as { budget: { catered: string[] } }.
export async function getBudgetState(db: Db): Promise<{ catered: string[] }> {
  const doc = await db.collection("meta").findOne({ _id: "budget" as never });
  return { catered: (doc?.catered as string[]) ?? [] };
}

export async function setCatered(db: Db, itemId: string, catered: boolean) {
  if (!FIXED_ITEMS.some((i) => i.id === itemId)) throw new Error("Unknown item");
  const op = catered ? { $addToSet: { catered: itemId } } : { $pull: { catered: itemId } };
  await db.collection("meta").updateOne({ _id: "budget" as never }, op, { upsert: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function budgetSummary(cateredIds: string[], deptRevenue: { nursing: number; mee: number }) {
  const catered = FIXED_ITEMS.filter((i) => cateredIds.includes(i.id));
  const cateredTotal = catered.reduce((s, i) => s + i.cost, 0);
  const outstandingTotal = TOTAL_FIXED - cateredTotal;

  const shareCatered = cateredTotal / 2;      // each dept's half of what's been paid
  const shareTotal = TOTAL_FIXED / 2;         // each dept's half of ALL fixed cost
  const shareOutstanding = outstandingTotal / 2;

  const dept = (rev: number) => ({
    revenue: rev,
    shareCatered,                     // what they've committed so far (half of catered)
    shareTotal,                       // their eventual total obligation (half of all fixed)
    shareOutstanding,                 // half of what's not yet catered
    balanceAfterCatered: rev - shareCatered,   // revenue left after paying their catered share
    balanceAfterAll: rev - shareTotal,         // revenue left if ALL fixed costs settled
  });

  return {
    totalFixed: TOTAL_FIXED,
    cateredTotal,
    outstandingTotal,
    depts: { nursing: dept(deptRevenue.nursing), mee: dept(deptRevenue.mee) },
    combinedBalanceAfterCatered: (deptRevenue.nursing + deptRevenue.mee) - cateredTotal,
    combinedBalanceAfterAll: (deptRevenue.nursing + deptRevenue.mee) - TOTAL_FIXED,
  };
}