import { Db, ObjectId } from "mongodb";
import { env } from "./env";

type Status = "pending" | "successful" | "failed";

// Derive the status endpoint from the checkout URL:
// .../transaction/checkout-for-mech-dinner  ->  .../transaction/transaction-status/<ref>
function statusUrl(ref: string): string {
  const base = env.checkoutApiUrl.replace(/\/[^/]+$/, "");
  return `${base}/transaction-status/${ref}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkAndSyncStatus(db: Db, order: any): Promise<Status> {
  if (order.test) return "successful";                 // test orders: skip API
  if (order.status === "successful") return "successful"; // cached: no API call
  if (!order.transactionRef) return order.status ?? "pending";

  try {
    const res = await fetch(statusUrl(order.transactionRef), { headers: { accept: "application/json" } });
    if (!res.ok) return order.status ?? "pending";
    const data = (await res.json()) as { status?: Status };
    const status = data?.status;
    if (status && status !== order.status) {
      await db.collection("orders").updateOne(
        { _id: new ObjectId(order._id) },
        { $set: { status, statusCheckedAt: new Date() } }
      );
    }
    return status ?? order.status ?? "pending";
  } catch {
    return order.status ?? "pending";
  }
}