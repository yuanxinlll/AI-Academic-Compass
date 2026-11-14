import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { apiError } from "@/lib/api";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { CATEGORIES as CATEGORY_LIST, OPPORTUNITY_STATUSES } from "@/lib/validation";

// GET /api/opportunities — see docs/contracts.md §4.1
const SORTS = ["deadline", "newest", "relevance"];
const CATEGORIES: readonly string[] = CATEGORY_LIST;
const STATUSES: readonly string[] = OPPORTUNITY_STATUSES;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const categories = (p.get("category") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const university = p.get("university") ?? "UCSD";
  const status = p.get("status");
  const q = p.get("q")?.trim().slice(0, 200);
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
  else {
    // Default view: hide expired records AND anything whose deadline has already passed
    // (the collector may not have re-checked the page yet).
    where.push("status <> 'expired'");
    where.push("(deadline IS NULL OR deadline >= CURRENT_DATE)");
  }
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
        `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o ${whereSql}
         ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      ),
      sql.query(`SELECT count(*)::int AS total FROM opportunities o ${whereSql}`, params),
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
