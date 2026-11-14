import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";

/** Returns an error Response unless the request carries the correct x-admin-token. */
export function requireAdmin(req: NextRequest): Response | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return apiError(503, "ADMIN_NOT_CONFIGURED", "ADMIN_TOKEN is not set on the server");
  const a = Buffer.from(req.headers.get("x-admin-token") ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return apiError(401, "UNAUTHORIZED", "Missing or invalid x-admin-token");
  return null;
}
