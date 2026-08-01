import crypto from "node:crypto";
import { env } from "./env";

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Store a hash, never the raw code.
export function hashCode(code: string): string {
  return crypto.createHmac("sha256", env.appSecret).update(code).digest("hex");
}

// Stateless "email was verified" proof the checkout route can trust.
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", env.appSecret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac("sha256", env.appSecret).update(data).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof body.exp !== "number" || Date.now() > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

// Non-expiring signature for QR check-in URLs (so order IDs can't be forged).
export function signId(id: string): string {
  return crypto.createHmac("sha256", env.appSecret).update(id).digest("hex").slice(0, 32);
}

export function verifyId(id: string, sig: string): boolean {
  const expected = signId(id);
  const a = Buffer.from(String(sig || "")), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}