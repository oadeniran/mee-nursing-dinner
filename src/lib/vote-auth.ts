import { cookies } from "next/headers";
import { signToken, verifyToken } from "./security";

const COOKIE = "voter_session";
const TTL = 24 * 60 * 60;

export const normMatric = (m: string) => String(m || "").trim().toLowerCase();

export async function createVoterSession(matric: string, dept: string) {
  const token = signToken({ role: "voter", matric: normMatric(matric), dept }, TTL);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: TTL });
}

export async function getVoter(): Promise<{ matric: string; dept: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const v = verifyToken(token);
  return v && v.role === "voter" ? { matric: v.matric as string, dept: v.dept as string } : null;
}

export async function clearVoterSession() {
  (await cookies()).delete(COOKIE);
}