import { NextResponse, connection } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS, PROFILE_COLUMNS } from "@/lib/database/columns";
import { handleError } from "@/lib/api";
import { matchProfile } from "@/lib/match-service";
import { demoEmail } from "@/lib/demo-accounts";
import { eligibilityBadge } from "@/lib/client/labels";
import type { MatchResult, Opportunity } from "@/lib/client/types";

// GET /api/access-gap — Data for Good: the same open listings, seen by four fictional students,
// plus how often listings state the facts students need. Public; no personal data.
// Counts describe the listings WE collected, not every opportunity at UC San Diego.

const PERSONAS = [
  { username: "maya", label: "Typical student", detail: "CS sophomore" },
  { username: "jordan", label: "First-generation", detail: "Biology junior" },
  { username: "priya", label: "Community college transfer", detail: "Cog Sci junior, first-gen" },
  { username: "wei", label: "International (F-1)", detail: "Data Science junior" },
] as const;

const BUCKETS = ["Eligible", "Likely eligible", "Check requirements", "Likely not eligible", "Not eligible"] as const;

let cache: { at: number; body: unknown } | null = null;
const TTL_MS = 5 * 60 * 1000;

function pct(n: number, d: number) {
  return d ? Math.round((100 * n) / d) : 0;
}

export async function GET() {
  await connection();
  try {
    if (cache && Date.now() - cache.at < TTL_MS) return NextResponse.json(cache.body);
    const sql = getSql();
    const opps = (await sql.query(
      `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o
        WHERE o.status <> 'expired' AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)
        ORDER BY o.deadline ASC NULLS LAST LIMIT 200`,
    )) as unknown as Opportunity[];
    const n = opps.length;
    const val = (o: Opportunity, k: keyof NonNullable<Opportunity["access"]>) => o.access?.[k]?.value ?? "unstated";

    const transparency = [
      { key: "deadline", label: "States a deadline (or says rolling)", count: opps.filter((o) => o.deadline || o.deadline_text).length },
      { key: "eligibility", label: "States who is eligible", count: opps.filter((o) => (o.eligibility ?? []).length > 0).length },
      { key: "apply", label: "Says how to apply", count: opps.filter((o) => o.application_method).length },
      { key: "international", label: "Says whether international students can apply", count: opps.filter((o) => val(o, "international") !== "unstated").length },
      { key: "compensation", label: "Says whether it is paid, for credit or unpaid", count: opps.filter((o) => val(o, "compensation") !== "unstated").length },
    ].map((t) => ({ ...t, pct: pct(t.count, n) }));

    const access = {
      international_open: opps.filter((o) => val(o, "international") === "open").length,
      international_restricted: opps.filter((o) => val(o, "international") === "restricted").length,
      international_unstated: opps.filter((o) => val(o, "international") === "unstated").length,
      first_gen_focus: opps.filter((o) => val(o, "first_gen") === "focus").length,
      transfer_focus: opps.filter((o) => val(o, "transfer") === "focus").length,
      paid_or_stipend: opps.filter((o) => ["paid", "stipend"].includes(val(o, "compensation"))).length,
      verified: opps.filter((o) => o.status === "verified").length,
      by_source_kind: Object.fromEntries(
        ["webpage", "flyer_image", "instagram"].map((k) => [k, opps.filter((o) => (o.source_kind ?? "webpage") === k).length]),
      ),
    };

    let personas: unknown = null;
    let persona_error: string | null = null;
    if (n) {
      try {
        const profiles = await sql.query(
          `SELECT ${PROFILE_COLUMNS}, interest_keywords, first_generation, transfer_student, international_student, u.name AS username
             FROM student_profiles p JOIN users u USING (user_id) WHERE u.email = ANY($1::text[])`,
          [PERSONAS.map((p) => demoEmail(p.username))],
        );
        const byName = new Map(profiles.map((p) => [p.username as string, p]));
        personas = await Promise.all(
          PERSONAS.filter((p) => byName.has(p.username)).map(async (p) => {
            const { username: _u, ...profile } = byName.get(p.username)!;
            void _u;
            const { results } = await matchProfile(profile, opps as unknown as Record<string, unknown>[]);
            const byId = new Map(results.map((r) => [r.opportunity_id, r as unknown as MatchResult]));
            const counts = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<(typeof BUCKETS)[number], number>;
            let paidOpen = 0;
            for (const o of opps) {
              const badge = eligibilityBadge(o, byId.get(o.opportunity_id));
              if (badge) counts[badge.label as (typeof BUCKETS)[number]]++;
              const notOut = badge && !["Not eligible", "Likely not eligible"].includes(badge.label);
              if (notOut && ["paid", "stipend"].includes(val(o, "compensation"))) paidOpen++;
            }
            const designedFor =
              (profile.first_generation ? opps.filter((o) => val(o, "first_gen") === "focus").length : 0) +
              (profile.transfer_student ? opps.filter((o) => val(o, "transfer") === "focus").length : 0);
            return {
              username: p.username,
              label: p.label,
              detail: p.detail,
              counts,
              open_to_apply: counts["Eligible"] + counts["Likely eligible"] + counts["Check requirements"],
              paid_open: paidOpen,
              designed_for: designedFor,
              closed_by_citizenship: profile.international_student ? access.international_restricted : 0,
              unclear_for_them: profile.international_student ? access.international_unstated : 0,
            };
          }),
        );
      } catch (e) {
        persona_error = e instanceof Error ? e.message : "matching unavailable";
      }
    }

    const body = {
      generated_at: new Date().toISOString(),
      total_open: n,
      transparency,
      access,
      buckets: BUCKETS,
      personas,
      persona_error,
      caveat:
        "Counts describe the public listings Academic Compass collected, not every opportunity at UC San Diego. Personas are fictional.",
    };
    if (!persona_error) cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (err) {
    return handleError("GET /api/access-gap", err);
  }
}
