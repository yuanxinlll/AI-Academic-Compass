import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiError, handleError, readJson } from "@/lib/api";
import { findDemoAccount } from "@/lib/demo-accounts";
import { authConfigured, encodeSession, setSessionCookie } from "@/lib/session";
import { currentUserView } from "@/lib/me";

// POST /api/auth/login — { username, password? } → signs in to a fixed demo account.
// Student accounts need no password. The admin account needs DEMO_ADMIN_PASSWORD when it is set.
export async function POST(req: NextRequest) {
  try {
    if (!authConfigured()) return apiError(503, "AUTH_NOT_CONFIGURED", "AUTH_SECRET is not set on the server");
    const body = (await readJson(req)) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const acct = findDemoAccount(username);
    if (!acct) return apiError(400, "INVALID_INPUT", "Unknown demo account", "username");

    if (acct.role === "admin") {
      const expected = process.env.DEMO_ADMIN_PASSWORD;
      if (expected) {
        const a = Buffer.from(typeof body?.password === "string" ? body.password : "");
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b))
          return apiError(401, "UNAUTHORIZED", "Wrong admin password", "password");
      }
    }

    const res = NextResponse.json({ user: await currentUserView(acct.username) });
    setSessionCookie(res, encodeSession(acct.username, acct.role));
    return res;
  } catch (err) {
    return handleError("POST /api/auth/login", err);
  }
}
