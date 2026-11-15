// Signed session cookie for demo accounts: base64url(JSON payload) + "." + HMAC-SHA256.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { Role } from "@/lib/demo-accounts";

export const SESSION_COOKIE = "ac_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type Session = { username: string; role: Role; iat: number };

function secret(): string | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 16 ? s : null;
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function authConfigured(): boolean {
  return secret() !== null;
}

export function encodeSession(username: string, role: Role): string {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET is not set (min 16 chars)");
  const payload: Session = { username, role, iat: Math.floor(Date.now() / 1000) };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

export function readSession(req: NextRequest): Session | null {
  const key = secret();
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!key || !raw) return null;
  const [data, mac] = raw.split(".");
  if (!data || !mac) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(data, key));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    if (typeof s.username !== "string" || (s.role !== "student" && s.role !== "admin")) return null;
    if (Date.now() / 1000 - s.iat > MAX_AGE_SECONDS) return null;
    return s;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, value: string) {
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
