// Shared matching: B's fixed eligibility rules + D's relevance v2. Used by /api/match and /api/access-gap.
import { callAiService } from "@/lib/ai-service";
import { scoreAll } from "@/lib/relevance";

export type MatchRow = {
  opportunity_id: string;
  eligibility: { status: "eligible" | "ineligible" | "needs_confirmation"; checks: { type: string; result: string; raw_text?: string; reason?: string }[] };
  relevance_score: number | null;
  explanation: string;
  [k: string]: unknown;
};

// D-only profile columns that B's contract does not know.
const D_ONLY = ["interest_keywords", "interest_statement", "first_generation", "transfer_student", "international_student"];

export async function matchProfile(profile: Record<string, unknown>, opportunities: Record<string, unknown>[]) {
  const profileForB = { ...profile };
  for (const k of D_ONLY) delete profileForB[k];
  const result = (await callAiService("/internal/match", { profile: profileForB, opportunities })) as { results: MatchRow[] };

  applyAccessRules(profile, opportunities, result.results);
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
  return { ...result, results };
}

type AccessFact = { value?: string; quote?: string | null };

/**
 * Fixed rules on top of B's checks, using quoted "who can apply" facts (contracts §10.1).
 * Only the student's own self-reported background is used; nothing is inferred.
 *  - International student + source requires U.S. citizenship / work authorization -> ineligible.
 *  - International student + paid role or program + source silent on international eligibility
 *    -> needs confirmation (never eligible until someone confirms F-1 students may apply).
 */
export function applyAccessRules(profile: Record<string, unknown>, opportunities: Record<string, unknown>[], rows: MatchRow[]) {
  if (profile.international_student !== true) return;
  const byId = new Map(opportunities.map((o) => [o.opportunity_id as string, o]));
  for (const r of rows) {
    const o = byId.get(r.opportunity_id);
    if (!o) continue;
    const access = (o.access ?? {}) as Record<string, AccessFact>;
    const intl = access.international?.value ?? "unstated";
    const paid = ["paid", "stipend"].includes(access.compensation?.value ?? "") || ["internship", "program"].includes(o.category as string);
    const checks = r.eligibility.checks;
    if (intl === "restricted") {
      checks.push({
        type: "work_authorization",
        result: "ineligible",
        raw_text: access.international?.quote ?? undefined,
        reason: "The source requires U.S. citizenship, permanent residency or U.S. work authorization, and your profile says you are an international student.",
      });
      r.eligibility.status = "ineligible";
    } else if (intl === "unstated" && paid) {
      checks.push({
        type: "work_authorization",
        result: "needs_confirmation",
        reason: "This is paid or a formal program, and the source does not say whether F-1/J-1 students can take part. Ask before you apply.",
      });
      if (r.eligibility.status === "eligible") r.eligibility.status = "needs_confirmation";
    }
  }
}
