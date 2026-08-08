import { isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import { getStats } from "@/lib/stats";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic"; // always fresh

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const db = await getDb();
  const stats = await getStats(db);
  return <AdminDashboard stats={stats} />;
}