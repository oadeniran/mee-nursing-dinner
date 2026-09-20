import { Db } from "mongodb";
import { MAIN_COURSES, DESSERTS, SOUVENIR_DISCOUNT } from "./config";
import { getBudgetState, budgetSummary, FIXED_ITEMS, VARIABLE_ITEMS, TOTAL_FIXED } from "./budget";
import { getFoodPrices, personFoodCost } from "./food-config";
import { getExpenses, expenseSummary } from "./budget"; 

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

  const countsAsRealPlusOne = (o: typeof all[number]) =>
    o.ticketType === "plusOne" && !o.comped && !o.sponsorshipBonus;

  const guestsFrom = (list: typeof all) =>
    list.reduce((n, o) => n + (countsAsRealPlusOne(o) ? 2 : 1), 0);

  const guestsFromFull = (list: typeof all) =>
    list.reduce((n, o) => n + (o.ticketType === "plusOne" ? 2 : 1), 0);

  const revenueCollected = all.reduce((sum, o) => sum + (o.totalPaid ?? 0), 0);
  const revenueExpected = all.reduce((sum, o) => sum + (o.amountDue ?? o.ticket ?? 0), 0);

  const souvenirsNeeded = paid.reduce((n, o) => {
    if (o.dept !== "mee") return n;        // Nursing gets no souvenir
    if (o.souvenir === false) return n;    // MEE opted out
    return n + 1;                          // one per opted-in MEE ticket (plus-one doesn't add another)
  }, 0);

  const byDept = (key: string) => {
    const list = paid.filter((o) => o.dept === key);
    return {
      count: list.length,
      solo: list.filter((o) => o.ticketType === "single").length,
      plusOne: list.filter((o) => countsAsRealPlusOne(o)).length,
      guests: guestsFrom(list),
      // Revenue for settle-up EXCLUDES the souvenir portion for MEE opted-in tickets.
      revenue: list.reduce((s, o) => {
        const paidAmt = o.totalPaid ?? 0;
        const souvenirPortion =
          key === "mee" && o.souvenir !== false
            ? Math.min(SOUVENIR_DISCOUNT, paidAmt) // don't deduct more than they've paid
            : 0;
        return s + (paidAmt - souvenirPortion);
      }, 0),
    };
  };

  const expenses = await getExpenses(db);
  const baseSum = expenseSummary(expenses);

  const nRev = byDept("nursing").revenue;
  const mRev = byDept("mee").revenue;

  const expenseSum = {
    ...baseSum,
    nursing: { ...baseSum.nursing, revenue: nRev, leftAfterOwed: nRev - baseSum.nursing.owed, leftAfterPaid: nRev - baseSum.nursing.paid },
    mee: { ...baseSum.mee, revenue: mRev, leftAfterOwed: mRev - baseSum.mee.owed, leftAfterPaid: mRev - baseSum.mee.paid },
  };

  const { catered } = await getBudgetState(db);
  const budget = {
    summary: budgetSummary(catered, { nursing: byDept("nursing").revenue, mee: byDept("mee").revenue }),
    fixedItems: FIXED_ITEMS.map((i) => ({ ...i, catered: catered.includes(i.id) })),
    variableItems: VARIABLE_ITEMS,
    totalFixed: TOTAL_FIXED,
  };

  const foodPrices = await getFoodPrices(db);

  // One entry per PERSON (payer + plus-one as separate people). Paid or partial only.
  const foodPeople = (dept: string) => {
    
    const rows: {
      name: string; matric: string; ticket: string; main: string; dessert: string;
      mainCost: number; smallChops: number; chapman: number; cakeSlice: number; total: number; partial: boolean;
    }[] = [];

    const componentize = (deptKey: string, mainSel: string, dessertSel: string) => {
      const { items, total } = personFoodCost(foodPrices, deptKey, mainSel, dessertSel);
      // items is keyed by label; sum the main by "not one of the fixed labels"
      const smallChops = items["Small chops"] ?? 0;
      const chapman = items["Chapman"] ?? 0;
      const cakeSlice = items["Cake slice"] ?? 0;
      const mainCost = total - smallChops - chapman - cakeSlice; // whatever's left is the main
      return { mainCost, smallChops, chapman, cakeSlice, total };
    };

    for (const o of all) {
      if (o.dept !== dept) continue;
      if (o.status !== "successful" && o.status !== "partial") continue;
      const partial = o.status === "partial";

      const a = componentize(dept, o.attendee?.mainCourse ?? "", o.attendee?.dessert ?? "");
      rows.push({
        name: o.attendee?.name ?? "", matric: o.matricNo ?? "", ticket: o.ticketType === "plusOne" ? "Plus One" : "Solo",
        main: o.attendee?.mainCourse ?? "", dessert: o.attendee?.dessert ?? "",
        ...a, partial,
      });

      if (o.ticketType === "plusOne" && o.plusOne) {
        const p = componentize(dept, o.plusOne.mainCourse ?? "", o.plusOne.dessert ?? "");
        rows.push({
          name: `${o.plusOne.name} (+1 of ${o.attendee?.name ?? ""})`, matric: "", ticket: "+1",
          main: o.plusOne.mainCourse ?? "", dessert: o.plusOne.dessert ?? "",
          ...p, partial,
        });
      }
    }
    return rows;
  };

  const food = {
    prices: foodPrices,
    nursing: foodPeople("nursing"),
    mee: foodPeople("mee"),
  };

  return {
    headline: {
      paidTickets: paid.length,
      partialTickets: partial.length,
      confirmedGuests: guestsFrom(paid),
      guestsExpected: guestsFromFull(paid),
      allGuests: guestsFromFull(paid) + guestsFromFull(partial),
      checkedIn: paid.filter((o) => o.checkedIn).length,
      revenueCollected,
      revenueExpected,
      souvenirsNeeded: souvenirsNeeded,
    },
    budget,
    food,
    expenses,
    expenseSum,
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
      deptKey: o.dept ?? "",              // raw key for filtering (mee/nursing)
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
      souvenir: o.souvenir !== false,     // opted-in unless explicitly false
    })),
  };
}