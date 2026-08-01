import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { checkAndSyncStatus } from "@/lib/status";
import { generateQrDataUrl } from "@/lib/qr";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

    const db = await getDb();
    const docs = await db.collection("orders").find({ email: clean }).sort({ createdAt: -1 }).toArray();

    const orders = [];
    for (const o of docs) {
      const status = await checkAndSyncStatus(db, o);
      const qr = status === "successful" ? await generateQrDataUrl(o._id.toString()) : null;
      orders.push({
        orderId: o._id.toString(),
        name: o.attendee?.name ?? "",
        plusOneName: o.plusOne?.name ?? null,
        deptKey: o.dept ?? "",          // key, for resuming the form
        deptLabel: o.deptLabel ?? "",   // label, for display
        ticketType: o.ticketType,
        amount: o.amount,
        matricNo: o.matricNo ?? "",
        attendee: o.attendee,
        plusOne: o.plusOne,
        status,
        test: !!o.test,
        qr,
      });
    }

    return NextResponse.json({ orders });
  } catch (e) {
    console.error("verify error", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}