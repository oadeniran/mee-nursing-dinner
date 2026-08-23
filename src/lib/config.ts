// No secrets here, so both client and server can import it.

export const SOUVENIR_DISCOUNT = 10000; // MEE only, off the whole order when declined

// Fee is 1% of the ticket, capped at ₦300. Charged once on the full ticket price.
export const FEE_RATE = 0.01;
export const FEE_CAP = 300;
export const feeFor = (ticket: number) => Math.min(Math.round(ticket * FEE_RATE), FEE_CAP);

export const DEPARTMENTS = {
  nursing: { label: "Eximus Curantus", org: "Nursing" },
  mee: { label: "APOTHEOSIS de Me🅒anicos", org: "MEE" },
} as const;

// Per-department pricing. Same default for now, easy to change per dept later.
export const PRICING = {
  nursing: { single: 30000, plusOne: 55000 },
  mee: { single: 35000, plusOne: 55000 },
} as const;

export const MAIN_COURSES = ["Ofada Rice", "Pounded Yam", "Jollof + Fried"] as const;
export const DESSERTS = ["Cake Slice (Chocolate)", "Cake Slice (Red Velvet)"] as const;

export type Dept = keyof typeof PRICING;
export type TicketType = keyof (typeof PRICING)["nursing"];

export const supportsSouvenirOptOut = (d: Dept) => d === "mee";

export function ticketPrice(d: Dept, t: TicketType, souvenir = true): number {
  const base = PRICING[d][t];
  if (d === "mee" && souvenir === false) return base - SOUVENIR_DISCOUNT;
  return base;
}

export const totalAmount = (d: Dept, t: TicketType, souvenir = true) =>
  ticketPrice(d, t, souvenir) + feeFor(ticketPrice(d, t, souvenir));

export const MAX_SEATING_REQUESTS = 5;

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MEENSC123";