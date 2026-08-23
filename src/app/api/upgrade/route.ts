import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { checkAndSyncStatus } from "@/lib/status";
import { PRICING, MAIN_COURSES, DESSERTS, type Dept } from "@/lib/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type MenuChoice = { name: string; mainCourse: string; dessert: string };

function validMenu(m: MenuChoice): boolean {
  return !!m?.name?.trim()
    && (MAIN_COURSES as readonly string[]).includes(m.mainCourse)
    && (DESSERTS as readonly string[]).includes(m.dessert);
}

export async function POST(req: Request) {
  try {
    const { email, plusOne } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    if (!plusOne?.name?.trim() || !validMenu(plusOne))
      return NextResponse.json({ error: "Fill in your plus one's name and menu" }, { status: 400 });

    const db = await getDb();
    const orders = db.collection("orders");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order: any = await orders.findOne({ email: clean });
    if (!order) return NextResponse.json({ error: "No order found for that email" }, { status: 404 });

    // ---- Gates ----
    if (order.ticketType === "plusOne")
      return NextResponse.json({ error: "This ticket is already a Plus One." }, { status: 409 });
    if (order.checkedIn)
      return NextResponse.json({ error: "This ticket is already checked in and can't be upgraded." }, { status: 409 });

    // ---- New price for Plus One, respecting the stored souvenir choice ----
    const dept: Dept = order.dept;
    const souvenir = order.souvenir !== false; // MEE may have opted out
    const newTicket = PRICING[dept].plusOne - (dept === "mee" && !souvenir ? 10000 : 0);

    // Sanity: never let an "upgrade" lower what's owed.
    if (newTicket <= (order.amountDue ?? order.ticket ?? 0))
      return NextResponse.json({ error: "Upgrade price isn't higher than current — nothing to do." }, { status: 400 });

    const totalPaid: number = order.totalPaid ?? 0;
    const newRemaining = newTicket - totalPaid;

    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          ticketType: "plusOne",
          plusOne: { name: plusOne.name.trim(), mainCourse: plusOne.mainCourse, dessert: plusOne.dessert },
          ticket: newTicket,
          amountDue: newTicket,
          // If they'd fully paid the single, they're now partial again; otherwise stay partial/pending.
          status: totalPaid >= newTicket ? "successful" : (totalPaid > 0 ? "partial" : "pending"),
          upgradedAt: new Date(),
          // Any table assignment is stale now (party size changed) — clear it for re-run.
          tableNumber: null,
        },
      }
    );

    // Re-sync in case anything settled.
    const fresh = await orders.findOne({ _id: order._id });
    const status = await checkAndSyncStatus(db, fresh);

    return NextResponse.json({
      ok: true,
      amountDue: newTicket,
      totalPaid,
      remaining: Math.max(0, newRemaining),
      status,
    });
  } catch (e) {
    console.error("upgrade error", e);
    return NextResponse.json({ error: "Upgrade failed" }, { status: 500 });
  }
}