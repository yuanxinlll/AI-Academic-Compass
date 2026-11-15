import { getSql } from "@/lib/database/db";
import { demoEmail, findDemoAccount } from "@/lib/demo-accounts";

export type MeView = {
  username: string;
  display_name: string;
  role: "student" | "admin";
  disclaimer_accepted_at: string | null;
  has_profile: boolean;
};

/** Contract shape for GET /api/me and the login response. Creates the user row if missing. */
export async function currentUserView(username: string): Promise<MeView | null> {
  const acct = findDemoAccount(username);
  const displayName = acct?.displayName ?? username;
  const role = acct?.role ?? "student";
  const rows = await getSql().query(
    `WITH u AS (
       INSERT INTO users (email, name, display_name, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING user_id, display_name, role, disclaimer_accepted_at
     )
     SELECT COALESCE(u.display_name, $3) AS display_name, u.role,
            u.disclaimer_accepted_at::text AS disclaimer_accepted_at,
            EXISTS (SELECT 1 FROM student_profiles p WHERE p.user_id = u.user_id) AS has_profile
     FROM u`,
    [demoEmail(username), username, displayName, role],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    username,
    display_name: r.display_name as string,
    role: r.role as "student" | "admin",
    disclaimer_accepted_at: (r.disclaimer_accepted_at as string | null) ?? null,
    has_profile: Boolean(r.has_profile),
  };
}
