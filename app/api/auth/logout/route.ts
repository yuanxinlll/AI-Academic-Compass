import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

// POST /api/auth/logout
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
