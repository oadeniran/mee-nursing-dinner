import { Db } from "mongodb";

// Per-component food prices. Seeded here; editable from admin (stored in config collection).
export const DEFAULT_FOOD_PRICES = {
  ofada: 3500,       // "Ofada Rice + ..."
  jollof: 3500,      // "Jollof + Fried + ..."
  poundedYam: 3500,  // "Pounded Yam + ..." (iyan)
  smallChops: 1800,
  chapman: 1200,
  cakeSlice: 2300,   // MEE only
  parfait: 0,        // scrapped
};

export type FoodPrices = typeof DEFAULT_FOOD_PRICES;

export async function getFoodPrices(db: Db): Promise<FoodPrices> {
  const doc = await db.collection("config").findOne({ _id: "food_prices" as never });
  return { ...DEFAULT_FOOD_PRICES, ...(doc?.prices ?? {}) };
}

// Map a main-course selection string to its price key.
function mainPriceKey(main: string): keyof FoodPrices | null {
  const m = main.toLowerCase();
  if (m.includes("ofada")) return "ofada";
  if (m.includes("jollof")) return "jollof";
  if (m.includes("pounded") || m.includes("yam") || m.includes("iyan")) return "poundedYam";
  return null;
}


export async function setFoodPrices(db: Db, prices: Partial<FoodPrices>) {
  // Only accept known keys, coerce to non-negative integers.
  const clean: Record<string, number> = {};
  for (const k of Object.keys(DEFAULT_FOOD_PRICES) as (keyof FoodPrices)[]) {
    if (k in prices) clean[k] = Math.max(0, Math.round(Number(prices[k]) || 0));
  }
  await db.collection("config").updateOne({ _id: "food_prices" as never }, { $set: { prices: clean } }, { upsert: true });
}

// What one person's food costs, given their dept + dessert selection.
export function personFoodCost(prices: FoodPrices, dept: string, main: string, dessert: string): { items: Record<string, number>; total: number } {
  const items: Record<string, number> = {
    "Small chops": prices.smallChops,
    "Chapman": prices.chapman,
  };
  const key = mainPriceKey(main);
  if (key) items[main || "Main course"] = prices[key];  // label with their actual selection
  if (dept === "mee" && /cake/i.test(dessert)) items["Cake slice"] = prices.cakeSlice;
  const total = Object.values(items).reduce((s, v) => s + v, 0);
  return { items, total };
}