import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { setCatered } from "@/lib/budget";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { itemId, catered } = await req.json();
    const db = await getDb();
    await setCatered(db, String(itemId), catered === true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("budget update error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}