import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { setExpense, markExpensePaid, createExpense, deleteExpense, getExpenses } from "@/lib/budget";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const { id, fields, markPaid, action, name, cost } = await req.json();
  try {
    if (action === "create") await createExpense(db, name, Number(cost));
    else if (action === "delete") await deleteExpense(db, id);
    else if (typeof markPaid === "boolean") await markExpensePaid(db, id, markPaid);
    else await setExpense(db, id, fields ?? {});
    return NextResponse.json({ ok: true, expenses: await getExpenses(db) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}