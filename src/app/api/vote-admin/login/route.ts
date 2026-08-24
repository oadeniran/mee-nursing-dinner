import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createVoteAdminSession, clearVoteAdminSession } from "@/lib/vote-admin-auth";
import crypto from "node:crypto";

export async function POST(req: Request) {
  const { password } = await req.json();
  const a = Buffer.from(String(password || "")), b = Buffer.from(env.voteAdminPassword);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  await createVoteAdminSession();
  return NextResponse.json({ ok: true });
}
export async function DELETE() {
  await clearVoteAdminSession();
  return NextResponse.json({ ok: true });
}