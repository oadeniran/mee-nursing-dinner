import { NextResponse } from "next/server";
import type { UpdateFilter, Document } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { env } from "@/lib/env";
import { verifyToken } from "@/lib/security";
import { DEPARTMENTS, PRICING, feeFor, MAIN_COURSES, DESSERTS, type Dept, type TicketType } from "@/lib/config";

type MenuChoice = { name: string; mainCourse: string; dessert: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      dept, ticketType, matricNo, email, attendee, plusOne, token, testCode,
      seatingRequests, payNow, resume, souvenir // payNow: amount (₦) the user wants to pay this round
    } = body as {
      dept: Dept; ticketType: TicketType; matricNo: string; email: string;
      attendee: MenuChoice; plusOne: MenuChoice | null; token: string; testCode?: string;
      seatingRequests?: { label: string; value: string }[]; payNow?: number; resume?: boolean; souvenir?: boolean 
    };
    const cleanEmail = String(email || "").trim().toLowerCase();

    // Email OTP gate
    const v = verifyToken(token);
    if ((!v || v.purpose !== "payment" || v.email !== cleanEmail) && (!resume)) {
      return bad("Please verify your email before paying", 401);
    }
    
    // Test mode
    const wantsTest = typeof testCode === "string" && testCode.trim() !== "";
    if (wantsTest && testCode!.trim() !== env.testCode) return bad("Invalid test code", 400);
    const isTest = wantsTest;

    // Validate core fields
    if (!DEPARTMENTS[dept]) return bad("Invalid department");
    if (ticketType !== "single" && ticketType !== "plusOne") return bad("Invalid ticket type");
    if (!matricNo?.trim() || !attendee?.name?.trim()) return bad("Missing attendee details");
    if (!validMenu(attendee)) return bad("Invalid attendee menu");
    if (ticketType === "plusOne" && (!plusOne?.name?.trim() || !validMenu(plusOne)))
      return bad("Invalid plus-one details");

    // Souvenir opt-out is MEE-only; everyone else always gets it.
    const wantsSouvenir = dept === "mee" ? souvenir !== false : true;
    const ticket = PRICING[dept][ticketType] - (dept === "mee" && !wantsSouvenir ? 10000 : 0);
    const amountDue = ticket; // fee is per-transaction, added on top later

    const db = await getDb();
    const orders = db.collection("orders");
    const existing = await orders.findOne({ email: cleanEmail });

    const isResume = resume === true && existing && existing.status !== "successful";
    if (!isResume) {
      const v = verifyToken(token);
      if (!v || v.purpose !== "payment" || v.email !== cleanEmail)
        return bad("Please verify your email before paying", 401);
    }

    if (existing && existing.status === "successful" && !existing.test)
      return bad("This email already has a fully paid ticket. Visit the verify page to view it.", 409);

    const totalPaid: number = existing?.totalPaid ?? 0;
    const remaining = amountDue - totalPaid;
    if (remaining <= 0 && !isTest)
      return bad("This ticket is already fully paid.", 409);

    // How much of the TICKET to pay this round (server-clamped to the balance).
    let instalment = remaining;
    if (typeof payNow === "number" && Number.isFinite(payNow)) {
      const wanted = Math.round(payNow);
      if (wanted < 1) return bad("Enter a valid amount to pay", 400);
      instalment = Math.min(wanted, remaining);
    }

    // Provider fee on THIS transaction, added on top.
    const fee = feeFor(instalment);
    const chargeTotal = instalment + fee; // what we actually send to the checkout link

    const cleanSeating = Array.isArray(seatingRequests)
      ? seatingRequests
          .filter((r) => r && typeof r.value === "string" && r.value.trim() !== "")
          .slice(0, 5)
          .map((r) => ({ label: String(r.label ?? "").trim().slice(0, 80), value: String(r.value).trim().toLowerCase().slice(0, 120) }))
      : [];

    const base = {
      dept, deptLabel: DEPARTMENTS[dept].label, ticketType,
      matricNo: matricNo.trim(), email: cleanEmail,
      attendee, plusOne: ticketType === "plusOne" ? plusOne : null,
      ticket, amountDue,  souvenir: wantsSouvenir, test: isTest, updatedAt: new Date(),
      seatingRequests: cleanSeating,
    };

    if (isTest) {
      if (existing) {
        await orders.updateOne({ _id: existing._id }, { $set: { ...base, status: "successful", totalPaid: amountDue } });
        return NextResponse.json({ redirectUrl: `/success/${existing._id.toString()}` });
      }
      const r = await orders.insertOne({ ...base, status: "successful", totalPaid: amountDue, payments: [], createdAt: new Date(), tableNumber: null, seatingRequestIds: null });
      return NextResponse.json({ redirectUrl: `/success/${r.insertedId.toString()}` });
    }

    // pendingInstalment.amount = the TICKET portion to credit (fee excluded from the ledger).
    let _id;
    if (existing) {
      _id = existing._id;
      const update: UpdateFilter<Document> = {
        $set: {
          ...base, totalPaid,
          status: totalPaid > 0 ? "partial" : "pending",
          pendingInstalment: { amount: instalment, fee, charged: chargeTotal, transactionRef: null, at: new Date() },
        },
      };
      if (existing.transactionRef) {
        update.$push = { refHistory: { ref: existing.transactionRef, at: new Date() } } as unknown as UpdateFilter<Document>["$push"];
      }
      await orders.updateOne({ _id: existing._id }, update);
    } else {
      const r = await orders.insertOne({
        ...base, totalPaid: 0, status: "pending", payments: [],
        pendingInstalment: { amount: instalment, fee, charged: chargeTotal, transactionRef: null, at: new Date() },
        createdAt: new Date(), tableNumber: null, seatingRequestIds: null,
      });
      _id = r.insertedId;
    }
    let orderId = _id.toString();

    const callbackUrl = `${env.callbackBaseUrl}/success/${orderId}`;
    const checkoutUrl = `${env.checkoutApiBase}/checkout-for-mech-dinner`;
    const res = await fetch(checkoutUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: chargeTotal, // instalment + fee
        metadata: {
          attendeeName: attendee.name, callbackUrl, orderId, email: cleanEmail,
          department: DEPARTMENTS[dept].label, ticketType, matricNo: matricNo.trim(),
          ticketPortion: instalment, fee, amountDue, previouslyPaid: totalPaid,
        },
      }),
    });

    if (!res.ok) {
      await orders.updateOne({ _id }, { $set: { status: totalPaid > 0 ? "partial" : "checkout_failed", checkoutHttpStatus: res.status, pendingInstalment: null } });
      return bad("Could not start checkout, please try again", 502);
    }

    const data = (await res.json()) as { checkoutUrl: string; transactionRef: string };
    // Bind the provider's ref to the pending instalment so confirm can verify + credit it.
    await orders.updateOne(
      { _id },
      { $set: { transactionRef: data.transactionRef, checkoutUrl: data.checkoutUrl, "pendingInstalment.transactionRef": data.transactionRef } }
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