import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";
import {
  DEPARTMENTS,
  PRICING,
  FEE,
  MAIN_COURSES,
  DESSERTS,
  type Dept,
  type TicketType,
} from "@/lib/config";

type MenuChoice = { name: string; mainCourse: string; dessert: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dept, ticketType, matricNo, attendee, plusOne } = body as {
      dept: Dept;
      ticketType: TicketType;
      matricNo: string;
      attendee: MenuChoice;
      plusOne: MenuChoice | null;
    };

    // ---- Validate (never trust the client for money) ----
    if (!DEPARTMENTS[dept]) return bad("Invalid department");
    if (ticketType !== "single" && ticketType !== "plusOne") return bad("Invalid ticket type");
    if (!matricNo?.trim() || !attendee?.name?.trim()) return bad("Missing attendee details");
    if (!validMenu(attendee)) return bad("Invalid attendee menu");
    if (ticketType === "plusOne" && (!plusOne?.name?.trim() || !validMenu(plusOne)))
      return bad("Invalid plus-one details");

    // ---- Amount is computed server-side from the pricing map ----
    const ticket = PRICING[dept][ticketType];
    const amount = ticket + FEE;

    const db = await getDb();

    // ---- 1. Save first, so we have a DB id even if checkout fails ----
    const order = {
      dept,
      deptLabel: DEPARTMENTS[dept].label,
      ticketType,
      matricNo: matricNo.trim(),
      attendee,
      plusOne: ticketType === "plusOne" ? plusOne : null,
      ticket,
      fee: FEE,
      amount,
      status: "pending" as const,
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("orders").insertOne(order);
    const orderId = insertedId.toString();

    // ---- 2. Callback carries the DB id back to us ----
    const callbackUrl = `${env.callbackBaseUrl}/success/${orderId}`;

    // ---- 3. Ask the payment service for a checkout URL ----
    const res = await fetch(env.checkoutApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount, // NOTE: naira vs kobo — see caveat below
        metadata: {
          attendeeName: attendee.name,
          callbackUrl,
          orderId,
          department: DEPARTMENTS[dept].label,
          ticketType,
          matricNo: matricNo.trim(),
          attendee,
          plusOne: order.plusOne,
          ticket,
          fee: FEE,
        },
      }),
    });

    if (!res.ok) {
      await db.collection("orders").updateOne(
        { _id: insertedId },
        { $set: { status: "checkout_failed", checkoutHttpStatus: res.status } }
      );
      return bad("Could not start checkout, please try again", 502);
    }

    const data = (await res.json()) as { checkoutUrl: string; transactionRef: string };

    // ---- 4. Store the ref so the callback can be reconciled ----
    await db.collection("orders").updateOne(
      { _id: insertedId },
      { $set: { transactionRef: data.transactionRef, checkoutUrl: data.checkoutUrl } }
    );

    return NextResponse.json({ checkoutUrl: data.checkoutUrl, orderId });
  } catch (e) {
    console.error("checkout error", e);
    return bad("Something went wrong", 500);
  }
}

function validMenu(m: MenuChoice): boolean {
  return (
    !!m?.name?.trim() &&
    (MAIN_COURSES as readonly string[]).includes(m.mainCourse) &&
    (DESSERTS as readonly string[]).includes(m.dessert)
  );
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}