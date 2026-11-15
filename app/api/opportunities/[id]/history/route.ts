import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { apiError, handleError } from "@/lib/api";
import { UUID_RE } from "@/lib/validation";
import { ALGORITHM_VERSION } from "@/lib/relevance";
import { ELIGIBILITY_RULES_VERSION } from "@/lib/match-service";

type Ctx = { params: Promise<{ id: string }> };

// Detail fields that may be shown publicly, per action. Anything else stays in the database only.
const PUBLIC_DETAIL: Record<string, string[]> = {
  collected: ["page_sha256", "model"],
  recollected: ["page_sha256", "model", "kept_verified"],
  reported: ["reason"],
  report_resolved: ["reason"],
  lead_added: ["field", "evidence_url"],
  access_updated: ["international", "first_gen", "transfer", "compensation", "cost"],
  backfill: ["note"],
};

// GET /api/opportunities/{id}/history — provenance and the audit trail for one listing (public).
// Students are never named; reviewers show as "Reviewer".
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return apiError(400, "INVALID_INPUT", "id must be a UUID", "id");
    const sql = getSql();
    const rows = await sql.query(
      `SELECT provenance, source_url, first_collected_at, last_verified_at, status FROM opportunities WHERE opportunity_id = $1`,
      [id],
    );
    if (!rows[0]) return apiError(404, "NOT_FOUND", "Opportunity not found");
    const events = await sql.query(
      `SELECT at, actor_role, action, from_status, to_status, detail FROM opportunity_audit
        WHERE opportunity_id = $1 ORDER BY at DESC, audit_id DESC LIMIT 100`,
      [id],
    );
    return NextResponse.json({
      provenance: rows[0].provenance ?? null,
      source_url: rows[0].source_url,
      first_collected_at: rows[0].first_collected_at,
      rules: { eligibility: ELIGIBILITY_RULES_VERSION, relevance: ALGORITHM_VERSION },
      events: events.map((e) => ({
        at: e.at,
        actor: e.actor_role,
        action: e.action,
        from_status: e.from_status,
        to_status: e.to_status,
        detail: e.detail
          ? Object.fromEntries(Object.entries(e.detail).filter(([k]) => (PUBLIC_DETAIL[e.action] ?? []).includes(k)))
          : null,
      })),
    });
  } catch (err) {
    return handleError("GET /api/opportunities/[id]/history", err);
  }
}
