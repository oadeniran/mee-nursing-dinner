import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { checkAndSyncStatus } from "@/lib/status";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

    const db = await getDb();
    const o = await db.collection("orders").findOne({ email: clean });
    if (!o) return NextResponse.json({ error: "No order found for that email. Start a new ticket instead." }, { status: 404 });

    const status = await checkAndSyncStatus(db, o);
    if (status === "successful")
      return NextResponse.json({ error: "This ticket is already fully paid. Check it on the verify page." }, { status: 409 });

    const amountDue = o.amountDue ?? o.amount ?? 0;
    const fresh = await db.collection("orders").findOne({ _id: o._id }, { projection: { totalPaid: 1 } });
    const totalPaid = fresh?.totalPaid ?? o.totalPaid ?? 0;

    return NextResponse.json({
      order: {
        dept: o.dept, ticketType: o.ticketType, matricNo: o.matricNo ?? "",
        email: clean,
        attendee: o.attendee, plusOne: o.plusOne,
        seatingRequests: o.seatingRequests ?? [],
        souvenir: o.souvenir ?? true,
        amountDue, totalPaid, remaining: Math.max(0, amountDue - totalPaid),
      },
    });
  } catch (e) {
    console.error("order-lookup error", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}