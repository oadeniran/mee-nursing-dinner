// No secrets here, so both client and server can import it.

export const FEE = 300; // ₦300 charge added to every ticket

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
export const DESSERTS = ["Cake Slice", "Parfait"] as const;

export type Dept = keyof typeof PRICING;
export type TicketType = keyof (typeof PRICING)["nursing"];

export const ticketPrice = (d: Dept, t: TicketType) => PRICING[d][t];
export const totalAmount = (d: Dept, t: TicketType) => PRICING[d][t] + FEE;

export const MAX_SEATING_REQUESTS = 5;