import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { PROFILE_COLUMNS } from "@/lib/database/columns";
import { requireUser } from "@/lib/auth";
import { handleError, readJson } from "@/lib/api";
import { parseProfileInput } from "@/lib/validation";

// GET /api/profile — contracts §4.2
export async function GET(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const rows = await getSql().query(
      `SELECT ${PROFILE_COLUMNS} FROM student_profiles WHERE user_id = $1`,
      [userId],
    );
    return NextResponse.json({ profile: rows[0] ?? null });
  } catch (err) {
    return handleError("GET /api/profile", err);
  }
}

// POST /api/profile — create or fully replace the current user's profile (contracts §4.2)
export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;
    const p = parseProfileInput(await readJson(req));

    const rows = await getSql().query(
      `INSERT INTO student_profiles (
         user_id, university, major, minor, academic_year, expected_graduation,
         courses_taken, interests, research_areas, career_goals, selected_modules,
         skills, experiences, hours_per_week, available_terms, work_authorization, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7::text[], $8::text[], $9::text[], $10::text[], $11::text[],
         $12::text[], $13::jsonb, $14, $15::text[], $16, now()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         university = EXCLUDED.university, major = EXCLUDED.major, minor = EXCLUDED.minor,
         academic_year = EXCLUDED.academic_year, expected_graduation = EXCLUDED.expected_graduation,
         courses_taken = EXCLUDED.courses_taken, interests = EXCLUDED.interests,
         research_areas = EXCLUDED.research_areas, career_goals = EXCLUDED.career_goals,
         selected_modules = EXCLUDED.selected_modules, skills = EXCLUDED.skills,
         experiences = EXCLUDED.experiences, hours_per_week = EXCLUDED.hours_per_week,
         available_terms = EXCLUDED.available_terms,
         work_authorization = EXCLUDED.work_authorization, updated_at = now()
       RETURNING ${PROFILE_COLUMNS}`,
      [
        userId, p.university, p.major, p.minor, p.academic_year, p.expected_graduation,
        p.courses_taken, p.interests, p.research_areas, p.career_goals, p.selected_modules,
        p.skills, JSON.stringify(p.experiences), p.hours_per_week, p.available_terms,
        p.work_authorization,
      ],
    );
    return NextResponse.json({ profile: rows[0] });
  } catch (err) {
    return handleError("POST /api/profile", err);
  }
}
