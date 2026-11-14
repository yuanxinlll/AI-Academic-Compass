import type { NextRequest } from "next/server";
import { getSql } from "@/lib/database/db";
import { apiError } from "@/lib/api";

// ⚠️ TEMPORARY DEMO AUTH — replace with Neon Auth (Better Auth) before the final demo.
// The current user is chosen by the `x-demo-user` request header (default "demo").
// Anyone can pick any demo name, so only fictional data may be stored in this mode.
const NAME_RE = /^[a-z0-9_-]{1,32}$/;

export async function requireUser(
  req: NextRequest,
): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: Response }> {
  const name = (req.headers.get("x-demo-user") ?? "demo").trim().toLowerCase();
  if (!NAME_RE.test(name)) {
    return { error: apiError(401, "UNAUTHORIZED", "x-demo-user must be 1-32 chars of a-z, 0-9, _ or -") };
  }
  const rows = await getSql().query(
    `WITH ins AS (
       INSERT INTO users (email, name) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING user_id
     )
     SELECT user_id FROM ins
     UNION ALL
     SELECT user_id FROM users WHERE email = $1
     LIMIT 1`,
    [`${name}@demo.academic-compass.local`, name],
  );
  return { userId: rows[0].user_id as string };
}
