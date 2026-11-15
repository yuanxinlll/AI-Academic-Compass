import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { requireAdmin } from "@/lib/admin";
import { handleError } from "@/lib/api";

// GET /api/admin/review-queue — listings waiting for a human check, newest first.
// Admins can only change status (verified / expired); wrong fields go back to A's collector.
export async function GET(req: NextRequest) {
  await connection(); // per-request (reads cookies) — skip build-time prerender
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const sql = getSql();
    const [items, counts, reviewed, reports] = await Promise.all([
      sql.query(
        `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o
          WHERE o.status = 'needs_verification'
          ORDER BY (o.deadline IS NULL), o.deadline, o.first_collected_at DESC
          LIMIT 200`,
      ),
      sql.query(`SELECT status, count(*)::int AS n FROM opportunities GROUP BY status`),
      // Already-reviewed listings, so a decision can be undone after a page refresh.
      sql.query(
        `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o
          WHERE o.status IN ('verified', 'expired')
          ORDER BY o.status DESC, o.last_verified_at DESC
          LIMIT 100`,
      ),
      // Open student reports, with the listing they are about.
      sql.query(
        `SELECT r.report_id, r.reason, r.note, r.created_at, o.opportunity_id, o.title, o.organization, o.source_url, o.status
           FROM opportunity_reports r JOIN opportunities o USING (opportunity_id)
          WHERE r.resolved_at IS NULL
          ORDER BY r.created_at DESC
          LIMIT 100`,
      ).catch(() => []), // table missing before migration 005
    ]);
    return NextResponse.json({
      items,
      reviewed,
      reports,
      counts: Object.fromEntries(counts.map((r) => [r.status, r.n])),
    });
  } catch (err) {
    return handleError("GET /api/admin/review-queue", err);
  }
}
