import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireUser } from "@/lib/auth";
import { handleError, readJson } from "@/lib/api";
import { parseEvent } from "@/lib/calendar-validation";

const COLS = `event_id, title, kind, starts_at, ends_at, repeat_weekly, repeat_until::text AS repeat_until, opportunity_id, notes, updated_at`;

// GET /api/calendar — the signed-in student's own events (deadlines come from /api/bookmarks).
export async function GET(req: NextRequest) {
  await connection();
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const events = await getSql().query(`SELECT ${COLS} FROM student_events WHERE user_id = $1 ORDER BY starts_at`, [userId]);
    return NextResponse.json({ events });
  } catch (err) {
    return handleError("GET /api/calendar", err);
  }
}

// POST /api/calendar — create an event.
export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const e = parseEvent(await readJson(req));
    const sql = getSql();
    const n = await sql.query(`SELECT count(*)::int AS n FROM student_events WHERE user_id = $1`, [userId]);
    if (n[0].n >= 300) return NextResponse.json({ error: { code: "LIMIT", message: "Calendar is full (300 events)." } }, { status: 409 });
    const rows = await sql.query(
      `INSERT INTO student_events (user_id, title, kind, starts_at, ends_at, repeat_weekly, repeat_until, opportunity_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLS}`,
      [userId, e.title, e.kind, e.starts_at, e.ends_at, e.repeat_weekly, e.repeat_until, e.opportunity_id, e.notes],
    );
    return NextResponse.json({ event: rows[0] }, { status: 201 });
  } catch (err) {
    return handleError("POST /api/calendar", err);
  }
}
