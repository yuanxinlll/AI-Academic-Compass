import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireAdmin } from "@/lib/admin";
import { apiError, handleError } from "@/lib/api";
import { UUID_RE, ValidationError } from "@/lib/validation";

// POST /api/admin/reports/:id — mark a student report resolved.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("id", "must be a UUID");
    const rows = await getSql().query(
      `UPDATE opportunity_reports SET resolved_at = now() WHERE report_id = $1 AND resolved_at IS NULL RETURNING report_id`,
      [id],
    );
    if (!rows.length) return apiError(404, "NOT_FOUND", "No open report with that id");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError("POST /api/admin/reports/[id]", err);
  }
}
