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
