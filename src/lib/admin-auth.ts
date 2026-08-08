import { cookies } from "next/headers";
import { signToken, verifyToken } from "./security";

const COOKIE = "admin_session";
const TTL = 12 * 60 * 60; // 12 hours

export async function createAdminSession() {
  const token = signToken({ role: "admin" }, TTL);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: TTL,
  });
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const v = verifyToken(token);
  return !!v && v.role === "admin";
}

export async function clearAdminSession() {
  (await cookies()).delete(COOKIE);
}