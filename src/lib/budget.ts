import { Db, UpdateFilter, Document } from "mongodb";

// Fixed costs — seeded in code so they can't be casually edited in the UI.
// Update these values here as prices finalise.
export const FIXED_ITEMS = [
  { id: "venue",       name: "Venue",            cost: 230000, note: "Ifeloju and Diesel" },
  { id: "mc",          name: "MC",               cost: 70000,  note: "" },
  { id: "dj",          name: "DJ",               cost: 60000,  note: "Sound comes with Live band" },
  { id: "media",       name: "Media",            cost: 50000,  note: "" },
  { id: "videography", name: "Videography",      cost: 50000,  note: "" },
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
  const op: UpdateFilter<Document> = catered
    ? { $addToSet: { catered: itemId } }
    : { $pull: { catered: itemId } as unknown as UpdateFilter<Document>["$pull"] };
  await db.collection("meta").updateOne({ _id: "budget" as never }, op, { upsert: true });
}

// Per-department expense entries: shares and paid-so-far, both editable per dept.
// Seeded from fixed items with a default 50/50 split; edited/overridden in DB.
export type ExpenseEntry = {
  id: string; name: string; cost: number;
  nursingShare: number; meeShare: number;
  nursingPaid: number; meePaid: number;
  custom: boolean;
};

export async function getExpenses(db: Db): Promise<ExpenseEntry[]> {
  const doc = await db.collection("config").findOne({ _id: "expenses" as never });
  const byId: Record<string, Partial<ExpenseEntry>> = doc?.items ?? {};
  const custom: Record<string, Partial<ExpenseEntry> & { name: string }> = doc?.custom ?? {};

  // Seeded fixed items (with their overrides).
  const seeded = FIXED_ITEMS.map((it) => {
    const ov = byId[it.id] ?? {};
    const cost = ov.cost ?? it.cost;
    const nursingShare = ov.nursingShare ?? Math.round(cost / 2);
    const meeShare = ov.meeShare ?? (cost - Math.round(cost / 2));
    return {
      id: it.id, name: it.name, cost, nursingShare, meeShare,
      nursingPaid: ov.nursingPaid ?? 0, meePaid: ov.meePaid ?? 0, custom: false,
    };
  });

  // Custom items created from the admin UI.
  const customItems = Object.entries(custom).map(([id, c]) => {
    const cost = c.cost ?? 0;
    return {
      id, name: c.name, cost,
      nursingShare: c.nursingShare ?? Math.round(cost / 2),
      meeShare: c.meeShare ?? (cost - Math.round(cost / 2)),
      nursingPaid: c.nursingPaid ?? 0, meePaid: c.meePaid ?? 0, custom: true,
    };
  });

  return [...seeded, ...customItems];
}

// setExpense must now accept custom ids too — check both sources.
export async function setExpense(db: Db, id: string, fields: Partial<ExpenseEntry>) {
  const isSeeded = FIXED_ITEMS.some((i) => i.id === id);
  const doc = await db.collection("config").findOne({ _id: "expenses" as never });
  const isCustom = !!doc?.custom?.[id];
  if (!isSeeded && !isCustom) throw new Error("Unknown expense");

  const prefix = isCustom ? `custom.${id}` : `items.${id}`;
  const clean: Record<string, number> = {};
  for (const k of ["cost", "nursingShare", "meeShare", "nursingPaid", "meePaid"] as const) {
    if (k in fields) clean[k] = Math.max(0, Math.round(Number(fields[k]) || 0));
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clean)) set[`${prefix}.${k}`] = v;
  await db.collection("config").updateOne({ _id: "expenses" as never }, { $set: set }, { upsert: true });
}

export function expenseSummary(entries: ExpenseEntry[]) {
  const totalCost = entries.reduce((s, e) => s + e.cost, 0);
  const nursing = {
    owed: entries.reduce((s, e) => s + e.nursingShare, 0),
    paid: entries.reduce((s, e) => s + e.nursingPaid, 0),
  };
  const mee = {
    owed: entries.reduce((s, e) => s + e.meeShare, 0),
    paid: entries.reduce((s, e) => s + e.meePaid, 0),
  };
  return {
    totalCost,
    nursing: { ...nursing, balance: nursing.owed - nursing.paid },
    mee: { ...mee, balance: mee.owed - mee.paid },
  };
}

// Fill paid = share for both departments (the "mark fully paid" shortcut).
// markExpensePaid: same dual-source handling.
export async function markExpensePaid(db: Db, id: string, paid: boolean) {
  const entries = await getExpenses(db);
  const e = entries.find((x) => x.id === id);
  if (!e) throw new Error("Unknown expense");
  const prefix = e.custom ? `custom.${id}` : `items.${id}`;
  const set = paid
    ? { [`${prefix}.nursingPaid`]: e.nursingShare, [`${prefix}.meePaid`]: e.meeShare }
    : { [`${prefix}.nursingPaid`]: 0, [`${prefix}.meePaid`]: 0 };
  await db.collection("config").updateOne({ _id: "expenses" as never }, { $set: set }, { upsert: true });
}

// Create a new custom expense.
export async function createExpense(db: Db, name: string, cost: number) {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Name required");
  const id = "custom-" + Date.now().toString(36); // unique, sortable
  const c = Math.max(0, Math.round(cost || 0));
  await db.collection("config").updateOne(
    { _id: "expenses" as never },
    { $set: { [`custom.${id}`]: { name: clean, cost: c, nursingShare: Math.round(c / 2), meeShare: c - Math.round(c / 2), nursingPaid: 0, meePaid: 0 } } },
    { upsert: true }
  );
  return id;
}

export async function deleteExpense(db: Db, id: string) {
  if (!id.startsWith("custom-")) throw new Error("Only custom items can be deleted");
  await db.collection("config").updateOne({ _id: "expenses" as never }, { $unset: { [`custom.${id}`]: "" } });
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