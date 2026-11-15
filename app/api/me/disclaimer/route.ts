import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { handleError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

// POST /api/me/disclaimer — records that the user read the AI disclaimer.
export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const rows = await getSql().query(
      `UPDATE users SET disclaimer_accepted_at = COALESCE(disclaimer_accepted_at, now())
       WHERE user_id = $1 RETURNING disclaimer_accepted_at::text AS disclaimer_accepted_at`,
      [userId],
    );
    return NextResponse.json({ disclaimer_accepted_at: rows[0]?.disclaimer_accepted_at ?? null });
  } catch (err) {
    return handleError("POST /api/me/disclaimer", err);
  }
}
