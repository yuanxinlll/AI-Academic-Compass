import type { NextRequest } from "next/server";
import { getSql } from "@/lib/database/db";
import { apiError } from "@/lib/api";
import { readSession } from "@/lib/session";
import { demoEmail, findDemoAccount } from "@/lib/demo-accounts";

// Demo auth. The browser signs in to a fixed demo account and gets a signed
// HttpOnly cookie (lib/session.ts). For scripts (tests/ai-smoke.sh, B's checks)
// the old `x-demo-user` header still works and maps to a fictional user.
// Only fictional data may be stored in this mode.
const NAME_RE = /^[a-z0-9_-]{1,32}$/;

export type CurrentUser = { userId: string; username: string; role: "student" | "admin" };

async function upsertUser(username: string, displayName: string, role: "student" | "admin"): Promise<string> {
  const rows = await getSql().query(
    `INSERT INTO users (email, name, display_name, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
     RETURNING user_id`,
    [demoEmail(username), username, displayName, role],
  );
  return rows[0].user_id as string;
}

/** Resolves the signed-in user, or null when nobody is signed in. */
export async function currentUser(req: NextRequest): Promise<CurrentUser | null> {
  const session = readSession(req);
  if (session) {
    const acct = findDemoAccount(session.username);
    if (!acct) return null;
    return { userId: await upsertUser(acct.username, acct.displayName, acct.role), username: acct.username, role: acct.role };
  }
  const header = req.headers.get("x-demo-user");
  if (header !== null) {
    const name = header.trim().toLowerCase();
    if (!NAME_RE.test(name) || name === "admin") return null; // header can never grant admin
    return { userId: await upsertUser(name, name, "student"), username: name, role: "student" };
  }
  return null;
}

export async function requireUser(
  req: NextRequest,
): Promise<{ userId: string; user: CurrentUser; error?: undefined } | { userId?: undefined; user?: undefined; error: Response }> {
  const user = await currentUser(req);
  if (!user) return { error: apiError(401, "UNAUTHORIZED", "Sign in to a demo account first") };
  return { userId: user.userId, user };
}
