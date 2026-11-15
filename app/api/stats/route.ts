import { NextResponse, connection } from "next/server";
import { getSql } from "@/lib/database/db";
import { handleError } from "@/lib/api";

// GET /api/stats — public, live numbers for the home page hero.
// "open" = not expired and deadline not passed (same rule as GET /api/opportunities).
export async function GET() {
  await connection(); // always live — never prerender at build time
  try {
    const sql = getSql();
    const [totals, byCategory] = await Promise.all([
      sql.query(
        `SELECT
           count(*) FILTER (WHERE open)::int                           AS open_total,
           count(*) FILTER (WHERE open AND status = 'verified')::int   AS verified_total,
           count(*) FILTER (WHERE open AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 14)::int AS closing_soon,
           count(DISTINCT source_id) FILTER (WHERE open)::int          AS sources_total,
           max(first_collected_at)                                     AS last_collected_at
         FROM (SELECT *, status <> 'expired' AND (deadline IS NULL OR deadline >= CURRENT_DATE) AS open
               FROM opportunities) o`,
      ),
      sql.query(
        `SELECT category, count(*)::int AS n FROM opportunities
          WHERE status <> 'expired' AND (deadline IS NULL OR deadline >= CURRENT_DATE)
          GROUP BY category ORDER BY n DESC`,
      ),
    ]);
    const t = totals[0];
    return NextResponse.json({
      open_total: t.open_total,
      verified_total: t.verified_total,
      closing_soon: t.closing_soon,
      sources_total: t.sources_total,
      last_collected_at: t.last_collected_at,
      by_category: Object.fromEntries(byCategory.map((r) => [r.category, r.n])),
    });
  } catch (err) {
    return handleError("GET /api/stats", err);
  }
}
