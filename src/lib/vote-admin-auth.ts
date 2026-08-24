import { cookies } from "next/headers";
import { signToken, verifyToken } from "./security";

const COOKIE = "vote_admin_session";
const TTL = 12 * 60 * 60;

export async function createVoteAdminSession() {
  const token = signToken({ role: "vote-admin" }, TTL);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: TTL });
}
export async function isVoteAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const v = verifyToken(token);
  return !!v && v.role === "vote-admin";
}
export async function clearVoteAdminSession() {
  (await cookies()).delete(COOKIE);
}