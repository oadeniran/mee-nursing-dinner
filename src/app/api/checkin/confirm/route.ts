import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyId, verifyToken } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const { orderId, sig, confirmToken } = await req.json();
    if (!orderId || !verifyId(String(orderId), String(sig)))
      return NextResponse.json({ error: "Invalid or tampered ticket" }, { status: 403 });

    // Must present a valid, unexpired verify token for THIS order.
    const v = verifyToken(String(confirmToken || ""));
    if (!v || v.purpose !== "checkin-confirm" || v.orderId !== String(orderId))
      return NextResponse.json({ error: "Please verify the code again", needsReverify: true }, { status: 401 });

    const db = await getDb();
    const orders = db.collection("orders");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let order: any;
    try {
      order = await orders.findOne({ _id: new ObjectId(String(orderId)) });
    } catch {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!order) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (order.checkedIn)
      return NextResponse.json({ error: "Already checked in", checkedInAt: order.checkedInAt, tableNumber: order.tableNumber ?? null }, { status: 409 });

    // Atomic double-entry guard.
    const checkedInAt = new Date();
    const result = await orders.updateOne(
      { _id: order._id, checkedIn: { $ne: true } },
      { $set: { checkedIn: true, checkedInAt } }
    );
    if (result.modifiedCount === 0)
      return NextResponse.json({ error: "Already checked in" }, { status: 409 });

    return NextResponse.json({
      ok: true,
      checkedInAt,
      tableNumber: order.tableNumber ?? null, // null = job hasn't placed them / walk-up
    });
  } catch (e) {
    console.error("checkin confirm error", e);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}