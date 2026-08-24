import { Db } from "mongodb";

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);

type Cat = { id: string; dept: string; title: string; enabled: boolean; candidates: string[] };

export const AWARD_CATEGORIES: Cat[] = [
  { id: "most-reserved", title: "Most Reserved", enabled: true, dept: "mee", candidates: [
    "DHO", "Divine", "Elite", "Elizabeth", "Femzi", "Kenny", "Korede", "Maigida",
    "Mayor", "Meshach", "Mustopha", "Olalekan", "Peter", "Prolific", "Spark",
    "Tofunmi", "Tommy-Jay", "Zacheous",
  ]},
  { id: "best-entrepreneur", title: "Best Entrepreneur", enabled: true, dept: "mee", candidates: [
    "Divine", "FillaaSurvey (Qari)", "Hilaq (Fareed)", "Shmeg", "Skrittles", "SpicebyDee",
  ]},
  { id: "best-dressed-male", title: "Best Dressed Male", enabled: true, dept: "mee", candidates: [
    "Adeoye Samuel", "Austin", "Daniel", "Fareed", "Ileri", "Israel", "Olalekan",
    "Prolific", "Pythagoras", "Raphy", "Sly", "Toles", "Tomisin",
  ]},
  { id: "best-dressed-female", title: "Best Dressed Female", enabled: true, dept: "mee", candidates: [
    "Divine", "Fathia", "Jessica", "Pelumi", "Temi", "Treasure",
  ]},
  { id: "most-sociable-male", title: "Most Sociable Male", enabled: true, dept: "mee", candidates: [
    "Daniel", "La wandzy", "Owoblow", "Sly", "Tomisin",
  ]},
  { id: "most-sociable-female", title: "Most Sociable Female", enabled: true, dept: "mee", candidates: [
    "Deborah", "Divine", "Fathia", "Jessica", "Temi", "Treasure",
  ]},
  { id: "most-influential", title: "Most Influential", enabled: true, dept: "mee", candidates: [
    "Boye Lala", "John (Class rep)", "Owoblow", "Tomisin",
  ]},
  { id: "most-reliable", title: "Most Reliable", enabled: true, dept: "mee", candidates: [
    "DHO", "Divine", "El John", "Maayor", "Owoblow", "Philip",
  ]},
  { id: "best-sportsman", title: "Best Sportsman", enabled: true, dept: "mee", candidates: [
    "Adelaja", "Daniel", "Idowu", "John Nelson",
  ]},
  { id: "academia-of-the-year", title: "Academia of the Year", enabled: true, dept: "mee", candidates: [
    "Austin", "Boye LaLa", "DHO", "Fashakin", "Fola", "George Falcon",
    "Ileri", "Israel", "John (Class rep)", "Sholu", "Zizo Trader",
  ]},
  { id: "money-bag", title: "Money Bag", enabled: true, dept: "mee", candidates: [
    "George Falcon", "Habeeb", "Jessica", "Owoblow", "Shmeg", "Toles",
  ]},
  { id: "political-icon", title: "Political Icon", enabled: true, dept: "mee", candidates: [
    "Abimifoluwa", "Daniel (Almost Gen Sec)", "Fareed", "Fathia", "Francis",
    "Mastermind (Bukola)", "Owoblow", "Tomisin",
  ]},
  { id: "best-clique", title: "Best Clique", enabled: true, dept: "mee", candidates: [
    "Femzi Nation", "Kabal", "Matrix", "MIT", "Samuel and Fashakin",
    "Toles x Hmoney", "Zizo Trader Family",
  ]},
  // Not finalised — flip enabled:true on vote-admin when ready.
  { id: "best-in-fooling", title: "Best in Fooling", enabled: false, dept: "mee", candidates: [] },
];

export const categoriesFor = (dept: string) => AWARD_CATEGORIES.filter((c) => c.dept === dept);

export type ResolvedCat = { id: string; title: string; candidates: { id: string; name: string }[] };

// Live categories for a dept: seed candidates, overlaid with DB edits + enabled toggle.
export async function getVotingCategories(db: Db, dept: string): Promise<ResolvedCat[]> {
  const overrides = await db.collection("award_config").find({ dept }).toArray();
  const byId = new Map(overrides.map((o) => [o.id, o]));

  return categoriesFor(dept)
    .map((c) => {
      const ov = byId.get(c.id);
      const enabled = ov?.enabled ?? c.enabled;
      const names: string[] = ov?.candidates ?? c.candidates;
      if (!enabled || names.length === 0) return null;
      return { id: c.id, title: ov?.title ?? c.title, candidates: names.map((n) => ({ id: slugify(n), name: n })) };
    })
    .filter(Boolean) as ResolvedCat[];
}

export async function isVotingOpen(db: Db, dept: string): Promise<boolean> {
  const doc = await db.collection("meta").findOne({ _id: `voting:${dept}` as never });
  return doc?.open === true; // default CLOSED until you open it
}