import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminSession, clearAdminSession } from "@/lib/admin-auth";
import crypto from "node:crypto";

export async function POST(req: Request) {
  const { password } = await req.json();
  const a = Buffer.from(String(password || ""));
  const b = Buffer.from(env.adminPassword);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  await createAdminSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}