import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { setFoodPrices, getFoodPrices } from "@/lib/food-config";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const { prices } = await req.json();
  await setFoodPrices(db, prices ?? {});
  return NextResponse.json({ ok: true, prices: await getFoodPrices(db) });
}