import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, tableNumber } = await req.json();
    const db = await getDb();
    // Blank clears the assignment; otherwise store as a number.
    const value = tableNumber === "" || tableNumber == null ? null : Math.round(Number(tableNumber));
    await db.collection("orders").updateOne({ _id: new ObjectId(String(id)) }, { $set: { tableNumber: value } });
    return NextResponse.json({ ok: true, tableNumber: value });
  } catch (e) {
    console.error("set-table error", e);
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}