import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { apiError } from "@/lib/api";

// GET /api/opportunities — see docs/contracts.md §4.1
const CATEGORIES = ["research", "internship", "event", "competition", "program", "course"];
const STATUSES = ["verified", "needs_verification", "expired"];
const SORTS = ["deadline", "newest", "relevance"];

const COLUMNS = `
  opportunity_id, title, university, organization, category, description,
  required_skills, eligibility, deadline::text AS deadline, deadline_text,
  application_method, source_url, source_id, first_collected_at,
  last_verified_at, status`;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const categories = (p.get("category") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const university = p.get("university") ?? "UCSD";
  const status = p.get("status");
  const q = p.get("q")?.trim();
  const sort = p.get("sort") ?? "deadline";
  const page = Math.max(1, Number(p.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(p.get("limit") ?? 20) || 20));

  if (categories.some((c) => !CATEGORIES.includes(c)))
    return apiError(400, "INVALID_CATEGORY", `category must be one of: ${CATEGORIES.join(", ")}`);
  if (status && !STATUSES.includes(status))
    return apiError(400, "INVALID_STATUS", `status must be one of: ${STATUSES.join(", ")}`);
  if (!SORTS.includes(sort))
    return apiError(400, "INVALID_SORT", `sort must be one of: ${SORTS.join(", ")}`);

  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replaceAll("$?", `$${params.length}`));
  };

  add("university = $?", university);
  if (status) add("status = $?", status);
  else where.push("status <> 'expired'");
  if (categories.length) add("category = ANY($?::text[])", categories);
  if (q) add("(title ILIKE $? OR description ILIKE $?)", `%${q}%`);

  // TODO(relevance): once /api/match (B) is wired up, sort by relevance_score
  // for logged-in users. Until then relevance falls back to deadline order.
  const orderBy =
    sort === "newest"
      ? "first_collected_at DESC"
      : "deadline ASC NULLS LAST, first_collected_at DESC";

  const whereSql = `WHERE ${where.join(" AND ")}`;

  try {
    const sql = getSql();
    const [items, countRows] = await Promise.all([
      sql.query(
        `SELECT ${COLUMNS} FROM opportunities ${whereSql}
         ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      ),
      sql.query(`SELECT count(*)::int AS total FROM opportunities ${whereSql}`, params),
    ]);

    return NextResponse.json({
      items,
      total: (countRows[0] as { total: number }).total,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/opportunities]", err);
    return apiError(500, "INTERNAL_ERROR", "Failed to load opportunities");
  }
}
