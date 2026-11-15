import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireUser } from "@/lib/auth";
import { apiError, handleError, readJson } from "@/lib/api";
import { ValidationError, isObject } from "@/lib/validation";

const KEYS = ["first_generation", "transfer_student", "international_student"] as const;

function tri(v: unknown, field: string): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "boolean") throw new ValidationError(field, `${field} must be true, false or null`);
  return v;
}

// GET/POST /api/profile/background — optional, self-reported background (null = prefer not to say).
// Never inferred. Used only for the student's own view and the anonymous Access Gap totals.
export async function GET(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const rows = await getSql().query(
      `SELECT first_generation, transfer_student, international_student FROM student_profiles WHERE user_id = $1`,
      [userId],
    );
    return NextResponse.json({ background: rows[0] ?? null });
  } catch (err) {
    return handleError("GET /api/profile/background", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const body = await readJson(req);
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const v = KEYS.map((k) => tri(body[k], k));
    const rows = await getSql().query(
      `UPDATE student_profiles SET first_generation = $2, transfer_student = $3, international_student = $4, updated_at = now()
        WHERE user_id = $1 RETURNING first_generation, transfer_student, international_student`,
      [userId, ...v],
    );
    if (!rows[0]) return apiError(404, "PROFILE_NOT_FOUND", "Create your profile first");
    return NextResponse.json({ background: rows[0] });
  } catch (err) {
    return handleError("POST /api/profile/background", err);
  }
}
