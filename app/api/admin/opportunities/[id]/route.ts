import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { requireAdmin } from "@/lib/admin";
import { apiError, handleError, readJson } from "@/lib/api";
import { OPPORTUNITY_STATUSES, UUID_RE, ValidationError, isObject, optEnum } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/opportunities/{id} — human review (contracts §4.7).
// Body: { "status": "verified" | "needs_verification" | "expired" }
// Marking 'verified' means a person checked the record against its source page,
// so the eligibility list can be treated as complete (contracts §4.4 rule 2).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("id", "id must be a UUID");
    const body = await readJson(req);
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const status = optEnum(body, "status", OPPORTUNITY_STATUSES);
    if (!status) throw new ValidationError("status", `status is required (${OPPORTUNITY_STATUSES.join(", ")})`);

    const rows = await getSql().query(
      `UPDATE opportunities o
          SET status = $2,
              last_verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE o.last_verified_at END
        WHERE o.opportunity_id = $1
        RETURNING ${OPPORTUNITY_COLUMNS}`,
      [id, status],
    );
    if (!rows[0]) return apiError(404, "NOT_FOUND", "Opportunity not found");
    return NextResponse.json({ opportunity: rows[0] });
  } catch (err) {
    return handleError("PATCH /api/admin/opportunities/[id]", err);
  }
}
