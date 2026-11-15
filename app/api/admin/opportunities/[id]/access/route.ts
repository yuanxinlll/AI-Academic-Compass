import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireAdmin } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { apiError, handleError, readJson } from "@/lib/api";
import { UUID_RE, ValidationError, isObject, parseAccess } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/admin/opportunities/{id}/access — set access facts (who can apply) for one listing.
// Used by the collector's backfill. Does not touch status or any other field.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("id", "id must be a UUID");
    const body = await readJson(req);
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const access = parseAccess(body.access);
    if (!access) throw new ValidationError("access", "access is required");
    const rows = await getSql().query(
      `UPDATE opportunities SET access = $2::jsonb WHERE opportunity_id = $1 RETURNING opportunity_id, access`,
      [id, JSON.stringify(access)],
    );
    if (!rows[0]) return apiError(404, "NOT_FOUND", "Opportunity not found");
    await audit(req, id, "access_updated", {
      detail: Object.fromEntries(Object.entries(access).map(([k, f]) => [k, f?.value ?? null])),
    });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return handleError("PUT /api/admin/opportunities/[id]/access", err);
  }
}
