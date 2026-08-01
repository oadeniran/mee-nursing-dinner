import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyId } from "@/lib/security";
import CheckinClient from "./CheckinClient";

export default async function CheckinPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sig?: string }>;
}) {
  const { id } = await params;
  const { sig } = await searchParams;

  // Bad or missing signature → never touch the DB.
  if (!sig || !verifyId(id, sig)) {
    return <Shell><h1 className="result-title">Invalid ticket</h1><p className="muted">This QR code isn&apos;t valid.</p></Shell>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: any = null;
  try {
    const db = await getDb();
    order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
  } catch { order = null; }

  if (!order) return <Shell><h1 className="result-title">Ticket not found</h1></Shell>;
  if (order.status !== "successful")
    return <Shell><h1 className="result-title">Not paid</h1><p className="muted">This ticket hasn&apos;t been paid for.</p></Shell>;

  return (
    <Shell>
      <CheckinClient
        orderId={id}
        sig={sig}
        name={order.attendee?.name ?? ""}
        plusOneName={order.plusOne?.name ?? null}
        dept={order.deptLabel ?? ""}
        ticketType={order.ticketType}
        mains={[order.attendee?.mainCourse, order.plusOne?.mainCourse].filter(Boolean)}
        desserts={[order.attendee?.dessert, order.plusOne?.dessert].filter(Boolean)}
        test={!!order.test}
        alreadyCheckedIn={!!order.checkedIn}
        checkedInAt={order.checkedInAt ? new Date(order.checkedInAt).toISOString() : null}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pay-main">
      <div className="pay-wrap" style={{ textAlign: "center" }}>{children}</div>
    </main>
  );
}