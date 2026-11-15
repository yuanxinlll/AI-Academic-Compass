import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { readSession } from "@/lib/session";

/**
 * Returns an error Response unless the caller is an admin: either a signed-in
 * admin demo account (browser) or the correct x-admin-token (A's collector, scripts).
 */
export function requireAdmin(req: NextRequest): Response | null {
  if (readSession(req)?.role === "admin") return null;
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return apiError(503, "ADMIN_NOT_CONFIGURED", "ADMIN_TOKEN is not set on the server");
  const a = Buffer.from(req.headers.get("x-admin-token") ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return apiError(401, "UNAUTHORIZED", "Admin sign-in or a valid x-admin-token is required");
  return null;
}
