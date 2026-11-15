import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { apiError, handleError, readJson } from "@/lib/api";
import { UUID_RE, ValidationError, isObject, optString } from "@/lib/validation";

const REPORT_REASONS = ["closed", "deadline", "requirements", "who_can_apply", "link", "other"] as const;

// POST /api/opportunities/:id/report — { reason, note? }. Signed-in students only; one open report per person per listing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("id", "must be a UUID");
    const b = await readJson(req);
    if (!isObject(b)) throw new ValidationError("body", "Request body must be a JSON object");
    if (typeof b.reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(b.reason))
      throw new ValidationError("reason", `reason must be one of: ${REPORT_REASONS.join(", ")}`);
    const note = optString(b, "note", 500);
    const sql = getSql();
    const exists = await sql.query(`SELECT 1 FROM opportunities WHERE opportunity_id = $1`, [id]);
    if (!exists.length) return apiError(404, "NOT_FOUND", "No such opportunity");
    const open = await sql.query(
      `SELECT report_id FROM opportunity_reports WHERE opportunity_id = $1 AND user_id = $2 AND resolved_at IS NULL`,
      [id, auth.userId],
    );
    if (open.length) {
      await sql.query(`UPDATE opportunity_reports SET reason = $2, note = $3, created_at = now() WHERE report_id = $1`, [
        open[0].report_id,
        b.reason,
        note,
      ]);
    } else {
      await sql.query(`INSERT INTO opportunity_reports (opportunity_id, user_id, reason, note) VALUES ($1,$2,$3,$4)`, [
        id,
        auth.userId,
        b.reason,
        note,
      ]);
    }
    await audit(req, id, "reported", { detail: { reason: b.reason } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleError("POST /api/opportunities/[id]/report", err);
  }
}
