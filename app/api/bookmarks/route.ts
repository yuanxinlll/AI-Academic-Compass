import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { requireUser } from "@/lib/auth";
import { apiError, handleError, readJson } from "@/lib/api";
import { APPLICATION_STATUSES, UUID_RE, ValidationError, isObject, optEnum } from "@/lib/validation";

type Row = Record<string, unknown> & { application_status: string; bookmark_updated_at: string };

function toItem({ application_status, bookmark_updated_at, ...opportunity }: Row) {
  return { opportunity, application_status, updated_at: bookmark_updated_at };
}

async function loadBookmarks(userId: string, opportunityId?: string) {
  return (await getSql().query(
    `SELECT ${OPPORTUNITY_COLUMNS},
            s.application_status, s.updated_at AS bookmark_updated_at
       FROM saved_opportunities s
       JOIN opportunities o ON o.opportunity_id = s.opportunity_id
      WHERE s.user_id = $1 ${opportunityId ? "AND s.opportunity_id = $2" : ""}
      ORDER BY s.updated_at DESC`,
    opportunityId ? [userId, opportunityId] : [userId],
  )) as Row[];
}

// GET /api/bookmarks — contracts §4.6
export async function GET(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    return NextResponse.json({ items: (await loadBookmarks(userId)).map(toItem) });
  } catch (err) {
    return handleError("GET /api/bookmarks", err);
  }
}

// POST /api/bookmarks — create or update a bookmark's application_status
export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const body = await readJson(req);
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const id = body.opportunity_id;
    if (typeof id !== "string" || !UUID_RE.test(id))
      throw new ValidationError("opportunity_id", "opportunity_id must be a UUID");
    const status = optEnum(body, "application_status", APPLICATION_STATUSES) ?? "saved";

    try {
      await getSql().query(
        `INSERT INTO saved_opportunities (user_id, opportunity_id, application_status, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, opportunity_id)
         DO UPDATE SET application_status = EXCLUDED.application_status, updated_at = now()`,
        [userId, id, status],
      );
    } catch (e) {
      if ((e as { code?: string }).code === "23503")
        return apiError(404, "NOT_FOUND", "Opportunity not found", "opportunity_id");
      throw e;
    }
    const [row] = await loadBookmarks(userId, id);
    return NextResponse.json(toItem(row));
  } catch (err) {
    return handleError("POST /api/bookmarks", err);
  }
}

// DELETE /api/bookmarks?opportunity_id=...
export async function DELETE(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const id = req.nextUrl.searchParams.get("opportunity_id");
    if (!id || !UUID_RE.test(id)) throw new ValidationError("opportunity_id", "opportunity_id must be a UUID");
    await getSql().query(
      `DELETE FROM saved_opportunities WHERE user_id = $1 AND opportunity_id = $2`,
      [userId, id],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError("DELETE /api/bookmarks", err);
  }
}
