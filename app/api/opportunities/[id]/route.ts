import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { apiError, handleError } from "@/lib/api";
import { UUID_RE } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/opportunities/{id} — one opportunity (public data). Expired ones are returned too,
// so an old shared link still opens and shows the "expired" state.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return apiError(400, "INVALID_INPUT", "id must be a UUID", "id");
    const rows = await getSql().query(`SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o WHERE o.opportunity_id = $1`, [id]);
    if (!rows[0]) return apiError(404, "NOT_FOUND", "Opportunity not found");
    const leads = await getSql().query(
      `SELECT field, value, quote, evidence_url, found_by, status, found_at FROM opportunity_leads
        WHERE opportunity_id = $1 AND status <> 'rejected' ORDER BY found_at DESC LIMIT 20`,
      [id],
    );
    return NextResponse.json({ opportunity: rows[0], leads });
  } catch (err) {
    return handleError("GET /api/opportunities/[id]", err);
  }
}
