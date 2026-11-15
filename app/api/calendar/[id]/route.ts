import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireUser } from "@/lib/auth";
import { apiError, handleError, readJson } from "@/lib/api";
import { parseEvent } from "@/lib/calendar-validation";
import { UUID_RE, ValidationError } from "@/lib/validation";

const COLS = `event_id, title, kind, starts_at, ends_at, repeat_weekly, repeat_until::text AS repeat_until, opportunity_id, notes, updated_at`;

// PUT /api/calendar/:id — replace an event (only the owner's).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("id", "must be a UUID");
    const e = parseEvent(await readJson(req));
    const rows = await getSql().query(
      `UPDATE student_events SET title=$3, kind=$4, starts_at=$5, ends_at=$6, repeat_weekly=$7, repeat_until=$8,
              opportunity_id=$9, notes=$10, updated_at=now()
        WHERE event_id = $1 AND user_id = $2 RETURNING ${COLS}`,
      [id, userId, e.title, e.kind, e.starts_at, e.ends_at, e.repeat_weekly, e.repeat_until, e.opportunity_id, e.notes],
    );
    if (!rows.length) return apiError(404, "NOT_FOUND", "No such event");
    return NextResponse.json({ event: rows[0] });
  } catch (err) {
    return handleError("PUT /api/calendar/[id]", err);
  }
}

// DELETE /api/calendar/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("id", "must be a UUID");
    const rows = await getSql().query(`DELETE FROM student_events WHERE event_id = $1 AND user_id = $2 RETURNING event_id`, [id, userId]);
    if (!rows.length) return apiError(404, "NOT_FOUND", "No such event");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError("DELETE /api/calendar/[id]", err);
  }
}
