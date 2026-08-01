import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";
import { verifyToken } from "@/lib/security";
import { DEPARTMENTS, PRICING, FEE, MAIN_COURSES, DESSERTS, type Dept, type TicketType } from "@/lib/config";
import type { UpdateFilter, Document } from "mongodb";

type MenuChoice = { name: string; mainCourse: string; dessert: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dept, ticketType, matricNo, email, attendee, plusOne, token, testCode } = body as {
      dept: Dept; ticketType: TicketType; matricNo: string; email: string;
      attendee: MenuChoice; plusOne: MenuChoice | null; token: string; testCode?: string;
    };
    const cleanEmail = String(email || "").trim().toLowerCase();

    // Email OTP gate
    const v = verifyToken(token);
    if (!v || v.purpose !== "payment" || v.email !== cleanEmail)
      return bad("Please verify your email before paying", 401);

    // Test mode
    const wantsTest = typeof testCode === "string" && testCode.trim() !== "";
    if (wantsTest && testCode!.trim() !== env.testCode) return bad("Invalid test code", 400);
    const isTest = wantsTest;

    // Validate
    if (!DEPARTMENTS[dept]) return bad("Invalid department");
    if (ticketType !== "single" && ticketType !== "plusOne") return bad("Invalid ticket type");
    if (!matricNo?.trim() || !attendee?.name?.trim()) return bad("Missing attendee details");
    if (!validMenu(attendee)) return bad("Invalid attendee menu");
    if (ticketType === "plusOne" && (!plusOne?.name?.trim() || !validMenu(plusOne)))
      return bad("Invalid plus-one details");

    const ticket = PRICING[dept][ticketType];
    const amount = ticket + FEE;
    const db = await getDb();
    const orders = db.collection("orders");

    // One order per email: real paid tickets are locked; pending/failed/test are reused.
    const existing = await orders.findOne({ email: cleanEmail });
    if (existing && existing.status === "successful" && !existing.test)
      return bad("You already have a ticket for this email. Visit the verify page to view it.", 409);

    const base = {
      dept, deptLabel: DEPARTMENTS[dept].label, ticketType,
      matricNo: matricNo.trim(), email: cleanEmail,
      attendee, plusOne: ticketType === "plusOne" ? plusOne : null,
      ticket, fee: FEE, amount, test: isTest, updatedAt: new Date(),
    };
    let insertedId;
    if (existing) {
      // Retry: reuse the same document, archive the previous ref.
      insertedId = existing._id;
      const update: UpdateFilter<Document> = {
        $set: { ...base, status: isTest ? "successful" : "pending" },
      };
      if (existing.transactionRef) {
        update.$push = {
          refHistory: { ref: existing.transactionRef, at: new Date() },
        } as unknown as UpdateFilter<Document>["$push"];
      }
      await orders.updateOne({ _id: existing._id }, update);
    } else {
      const r = await orders.insertOne({ ...base, status: isTest ? "successful" : "pending", createdAt: new Date() });
      insertedId = r.insertedId;
    }
    const orderId = insertedId.toString();

    // Test: skip the provider
    if (isTest) return NextResponse.json({ redirectUrl: `/success/${orderId}` });

    // Real: call the payment service
    const callbackUrl = `${env.callbackBaseUrl}/success/${orderId}`;
    const res = await fetch(env.checkoutApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        metadata: {
          attendeeName: attendee.name, callbackUrl, orderId, email: cleanEmail,
          department: DEPARTMENTS[dept].label, ticketType, matricNo: matricNo.trim(),
          attendee, plusOne: base.plusOne, ticket, fee: FEE,
        },
      }),
    });

    if (!res.ok) {
      await orders.updateOne({ _id: insertedId }, { $set: { status: "checkout_failed", checkoutHttpStatus: res.status } });
      return bad("Could not start checkout, please try again", 502);
    }

    const data = (await res.json()) as { checkoutUrl: string; transactionRef: string };
    await orders.updateOne(
      { _id: insertedId },
      { $set: { transactionRef: data.transactionRef, checkoutUrl: data.checkoutUrl, status: "pending", statusCheckedAt: null } }
    );

    return NextResponse.json({ checkoutUrl: data.checkoutUrl, orderId });
  } catch (e) {
    console.error("checkout error", e);
    return bad("Something went wrong", 500);
  }
}

function validMenu(m: MenuChoice): boolean {
  return !!m?.name?.trim()
    && (MAIN_COURSES as readonly string[]).includes(m.mainCourse)
    && (DESSERTS as readonly string[]).includes(m.dessert);
}
function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}