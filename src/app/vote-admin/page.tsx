import { isVoteAdmin } from "@/lib/vote-admin-auth";
import { getDb } from "@/lib/mongodb";
import { getVoteStats, getManageCategories } from "@/lib/vote-stats";
import VoteAdminLogin from "./VoteAdminLogin";
import VoteAdminDashboard from "./VoteAdminDashboard";

export const dynamic = "force-dynamic";

export default async function VoteAdminPage() {
  if (!(await isVoteAdmin())) return <VoteAdminLogin />;
  const db = await getDb();
  const dept = "mee"; // extend to a selector when Nursing joins
  const [stats, manage] = await Promise.all([getVoteStats(db, dept), getManageCategories(db, dept)]);
  return <VoteAdminDashboard stats={stats} manage={manage} />;
}