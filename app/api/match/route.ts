import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS, PROFILE_COLUMNS } from "@/lib/database/columns";
import { requireUser } from "@/lib/auth";
import { apiError, handleError } from "@/lib/api";
import { callAiService } from "@/lib/ai-service";
import { UUID_RE, ValidationError, isObject } from "@/lib/validation";
import { scoreAll } from "@/lib/relevance";

const MAX_OPPORTUNITIES = 200;

// POST /api/match — contracts §4.4 / §8.2.
// D loads the profile + opportunities from Neon; B's stateless service does the matching.
export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await requireUser(req);
    if (error) return error;

    // Body is optional: an empty body means "match all non-expired opportunities".
    const raw = await req.text();
    let body: unknown = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        throw new ValidationError("body", "Request body must be valid JSON");
      }
    }
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const ids = body.opportunity_ids;
    if (ids !== undefined && ids !== null) {
      if (!Array.isArray(ids) || ids.length > MAX_OPPORTUNITIES || ids.some((i) => typeof i !== "string" || !UUID_RE.test(i)))
        throw new ValidationError("opportunity_ids", `opportunity_ids must be an array of up to ${MAX_OPPORTUNITIES} UUIDs`);
    }

    const sql = getSql();
    const [profiles, opportunities] = await Promise.all([
      sql.query(`SELECT ${PROFILE_COLUMNS}, interest_keywords FROM student_profiles WHERE user_id = $1`, [userId]),
      Array.isArray(ids)
        ? sql.query(`SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o WHERE o.opportunity_id = ANY($1::uuid[])`, [ids])
        : sql.query(
            `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o
              WHERE o.status <> 'expired' AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)
              ORDER BY o.deadline ASC NULLS LAST LIMIT ${MAX_OPPORTUNITIES}`,
          ),
    ]);

    if (!profiles[0]) return apiError(404, "PROFILE_NOT_FOUND", "Complete your profile before matching");
    if (opportunities.length === 0) return NextResponse.json({ results: [] });

    const profile = profiles[0];
    // interest_keywords is a D-only column (migration 002); B's contract does not know it.
    const profileForB = { ...profile };
    delete profileForB.interest_keywords;
    const result = (await callAiService("/internal/match", { profile: profileForB, opportunities })) as {
      results: { opportunity_id: string; eligibility: { checks: { type: string; result: string; raw_text?: string }[] }; explanation?: string }[];
    };

    // Eligibility stays B's fixed rules. Relevance is rel-v2 (lib/relevance.ts).
    const checks = new Map(result.results.map((r) => [r.opportunity_id, r.eligibility?.checks ?? []]));
    const rel = scoreAll(profile, opportunities as Parameters<typeof scoreAll>[1], checks);
    const results = result.results.map((r) => {
      const v = rel.get(r.opportunity_id);
      if (!v) return r;
      const top = [...v.relevance_breakdown].filter((s) => s.score > 0).sort((a, b) => b.weight * b.score - a.weight * a.score);
      return {
        ...r,
        ...v,
        reasons: top.map((s) => s.explanation),
        explanation: top.length ? `${top[0].explanation}.` : "We found little overlap between this listing and your profile.",
      };
    });
    return NextResponse.json({ ...result, results });
  } catch (err) {
    return handleError("POST /api/match", err);
  }
}
