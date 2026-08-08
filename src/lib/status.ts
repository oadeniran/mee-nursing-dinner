import { Db, ObjectId, UpdateFilter, Document } from "mongodb";
import { env } from "./env";

type Status = "pending" | "partial" | "successful" | "failed";

function statusUrl(ref: string): string {
  return `${env.checkoutApiBase}/transaction-status/${ref}`;
}

/**
 * Reconciles an order's ledger against the payment provider.
 * Credits ONLY: a confirmed 'successful' ref + the amount we stored for it + not already counted.
 * The browser never contributes any number here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkAndSyncStatus(db: Db, order: any): Promise<Status> {
  if (order.test) return "successful";

  const amountDue: number = order.amountDue ?? order.amount ?? 0;
  let totalPaid: number = order.totalPaid ?? 0;

  // Already settled? Nothing to do.
  if (totalPaid >= amountDue && amountDue > 0) {
    if (order.status !== "successful") {
      await db.collection("orders").updateOne({ _id: new ObjectId(order._id) }, { $set: { status: "successful" } });
    }
    return "successful";
  }

  const pending = order.pendingInstalment;
  // No outstanding instalment to confirm → report current standing.
  if (!pending?.transactionRef) return totalPaid > 0 ? "partial" : (order.status ?? "pending");

  const ref: string = pending.transactionRef;

  // Dedupe: has this ref already been credited?
  const alreadyCounted = Array.isArray(order.payments) && order.payments.some((p: { transactionRef: string }) => p.transactionRef === ref);
  if (alreadyCounted) return totalPaid >= amountDue ? "successful" : "partial";

  try {
    console.log(`Checking status for order ${order._id} ref ${ref} with url ${statusUrl(ref)}`);
    const res = await fetch(statusUrl(ref), { headers: { accept: "application/json" } });
    if (!res.ok) return totalPaid > 0 ? "partial" : "pending";
    const data = (await res.json()) as { status?: Status };

    if (data?.status === "successful") {
      // Credit the amount WE stored for this instalment — not anything from the client.
      const credit: number = pending.amount ?? 0;
      const newTotal = totalPaid + credit;
      const settled = newTotal >= amountDue;

      const update: UpdateFilter<Document> = {
        $inc: { totalPaid: credit },
        $set: { status: settled ? "successful" : "partial", pendingInstalment: null, statusCheckedAt: new Date() },
      };
      update.$push = { payments: { transactionRef: ref, amount: credit, at: new Date() } } as unknown as UpdateFilter<Document>["$push"];

      await db.collection("orders").updateOne(
        { _id: new ObjectId(order._id), "payments.transactionRef": { $ne: ref } }, // guard double-credit
        update
      );

      totalPaid = newTotal;
      return settled ? "successful" : "partial";
    }

    if (data?.status === "failed") {
      await db.collection("orders").updateOne(
        { _id: new ObjectId(order._id) },
        { $set: { status: totalPaid > 0 ? "partial" : "failed", pendingInstalment: null } }
      );
      return totalPaid > 0 ? "partial" : "failed";
    }

    // still pending at the provider
    return totalPaid > 0 ? "partial" : "pending";
  } catch {
    return totalPaid > 0 ? "partial" : "pending";
  }
}