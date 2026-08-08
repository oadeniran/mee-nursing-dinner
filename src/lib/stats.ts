import { Db } from "mongodb";
import { MAIN_COURSES, DESSERTS } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function menuTallies(orders: any[]) {
  const mains: Record<string, number> = {};
  const desserts: Record<string, number> = {};
  for (const m of MAIN_COURSES) mains[m] = 0;
  for (const d of DESSERTS) desserts[d] = 0;
  for (const o of orders) {
    for (const person of [o.attendee, o.plusOne].filter(Boolean)) {
      if (person.mainCourse in mains) mains[person.mainCourse]++;
      if (person.dessert in desserts) desserts[person.dessert]++;
    }
  }
  return { mains, desserts };
}

export async function getStats(db: Db) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = await db.collection("orders").find({ test: { $ne: true } }).sort({ createdAt: -1 }).toArray();

  const paid = all.filter((o) => o.status === "successful");
  const partial = all.filter((o) => o.status === "partial");

  const guestsFrom = (list: typeof all) =>
    list.reduce((n, o) => n + (o.ticketType === "plusOne" ? 2 : 1), 0);

  const revenueCollected = all.reduce((sum, o) => sum + (o.totalPaid ?? 0), 0);
  const revenueExpected = all.reduce((sum, o) => sum + (o.amountDue ?? o.ticket ?? 0), 0);

  const byDept = (key: string) => {
    const list = paid.filter((o) => o.dept === key);
    return {
      count: list.length,
      solo: list.filter((o) => o.ticketType === "single").length,
      plusOne: list.filter((o) => o.ticketType === "plusOne").length,
      guests: guestsFrom(list),
      revenue: list.reduce((s, o) => s + (o.totalPaid ?? 0), 0),
    };
  };

  return {
    headline: {
      paidTickets: paid.length,
      partialTickets: partial.length,
      guestsExpected: guestsFrom(paid),
      checkedIn: paid.filter((o) => o.checkedIn).length,
      revenueCollected,
      revenueExpected,
    },
    statusCounts: {
      successful: paid.length,
      partial: partial.length,
      pending: all.filter((o) => o.status === "pending").length,
      failed: all.filter((o) => o.status === "failed").length,
    },
    depts: { nursing: byDept("nursing"), mee: byDept("mee") },
    menu: menuTallies(paid), // catering counts from fully-paid only
    orders: all.map((o) => ({
      id: o._id.toString(),
      name: o.attendee?.name ?? "",
      plusOneName: o.plusOne?.name ?? null,
      dept: o.deptLabel ?? o.dept ?? "",
      ticketType: o.ticketType,
      main: o.attendee?.mainCourse ?? "",
      dessert: o.attendee?.dessert ?? "",
      amountDue: o.amountDue ?? o.ticket ?? 0,
      totalPaid: o.totalPaid ?? 0,
      status: o.status,
      checkedIn: !!o.checkedIn,
      tableNumber: o.tableNumber ?? null,
      email: o.email ?? "",
      matricNo: o.matricNo ?? "",
    })),
  };
}