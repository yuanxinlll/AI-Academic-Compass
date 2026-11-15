// Relevance v2 ("rel-v2.0") — fixed, explainable scoring from the plan.
// Six signals; a signal with no data on either side is skipped and the others are rescaled.
// "Unknown is not 0." Relevance ≠ eligibility ≠ chance of acceptance.

export const ALGORITHM_VERSION = "rel-v2.0";

type Profile = {
  major?: string | null;
  interests?: string[];
  research_areas?: string[];
  interest_keywords?: string[];
  skills?: string[];
  selected_modules?: string[];
  hours_per_week?: number | null;
  available_terms?: string[];
};

type Requirement = { type: string; value: unknown; raw_text: string; is_hard_requirement: boolean };
type Opp = {
  opportunity_id: string;
  title: string;
  description: string | null;
  organization: string | null;
  category: string;
  required_skills: string[];
  eligibility: Requirement[];
  deadline_text?: string | null;
};
type Check = { type: string; result: string; raw_text?: string };

export type Signal = {
  key: "topic" | "skills" | "major" | "category" | "time" | "preferred";
  label: string;
  weight: number;
  score: number; // 0..1
  explanation: string;
};

export type Relevance = {
  relevance_score: number | null;
  relevance_breakdown: Signal[];
  signals_used: number;
  low_confidence: boolean;
  algorithm_version: string;
};

// ───────── fixed tables (public, see /how-it-works) ─────────
const SYNONYMS: Record<string, string[]> = {
  "machine learning": ["ml", "artificial intelligence", "deep learning", "neural network", "neural networks", "ai/ml", "artificial intelligence", "ai"],
  "human-computer interaction": ["hci", "user experience", "ux", "human computer interaction"],
  neuroscience: ["neuro", "neural", "brain", "neurobiology", "cognitive neuroscience"],
  "molecular biology": ["molecular", "genomics", "genetics", "biochemistry"],
  "data science": ["data analysis", "data analytics", "statistics", "data"],
  "data for social good": ["social good", "public interest", "community", "nonprofit", "policy", "equity"],
  "public health": ["health", "epidemiology", "global health"],
  "public policy": ["policy", "government"],
  "summer research": ["summer"],
  lab: ["laboratory"],
  python: ["python3"],
  r: ["r programming", "rstudio"],
  "wet lab techniques": ["wet lab", "bench", "pcr", "cell culture"],
  microscopy: ["microscope", "imaging"],
  sql: ["database", "databases"],
  react: ["frontend", "web development"],
};

const FIELDS: Record<string, string[]> = {
  cs: ["computer science", "computing", "software", "programming", "machine learning", "artificial intelligence", "ai/ml", "algorithm", "cse"],
  data: ["data science", "statistics", "data analysis", "dsc", "analytics"],
  bio: ["biology", "biological", "genomics", "molecular", "cell", "ecology", "bioengineering", "bioinformatics", "computational biology"],
  neuro: ["neuroscience", "neural", "brain", "neurobiology"],
  chem: ["chemistry", "chemical", "biochemistry"],
  physics: ["physics", "astrophysics", "quantum"],
  math: ["mathematics", "math"],
  cogsci: ["cognitive science", "cognition", "cognitive", "human-computer interaction", "hci", "perception", "language development"],
  psych: ["psychology", "developmental", "child development", "behavior"],
  earth: ["earth science", "ocean", "oceanography", "climate", "scripps", "geology", "tectonic", "marine"],
  eng: ["engineering", "materials", "mechanical", "electrical", "robotics", "3d bioprinting"],
  health: ["public health", "medicine", "medical", "clinical", "health"],
  social: ["policy", "economics", "sociology", "social science", "political", "community"],
};

const MAJOR_TO_FIELD: [RegExp, string][] = [
  [/computer|software|cse/, "cs"],
  [/data science|statistic/, "data"],
  [/neuro/, "neuro"],
  [/cognitive|cog ?sci/, "cogsci"],
  [/bio(?!eng)|ecology|genetic|molecular/, "bio"],
  [/chem/, "chem"],
  [/physic/, "physics"],
  [/math/, "math"],
  [/psych/, "psych"],
  [/earth|ocean|marine|climate|geo/, "earth"],
  [/engineer|bioeng/, "eng"],
  [/health|medic|nursing/, "health"],
  [/econ|polit|socio|policy|public/, "social"],
];

const ADJACENT: Record<string, string[]> = {
  cs: ["data", "math", "cogsci", "eng"],
  data: ["cs", "math", "social", "health", "cogsci"],
  bio: ["neuro", "chem", "health", "earth", "eng"],
  neuro: ["bio", "cogsci", "psych", "health"],
  chem: ["bio", "physics", "eng"],
  physics: ["math", "chem", "eng", "earth"],
  math: ["cs", "data", "physics"],
  cogsci: ["psych", "neuro", "cs", "data"],
  psych: ["cogsci", "neuro", "health", "social"],
  earth: ["bio", "physics", "chem"],
  eng: ["cs", "physics", "chem", "bio"],
  health: ["bio", "neuro", "psych", "data", "social"],
  social: ["data", "psych", "health"],
};

const TERMS = ["fall", "winter", "spring", "summer"];

// Words that appear in nearly every listing; they say nothing about topic.
const GENERIC = new Set(["research", "lab", "laboratory", "internship", "program", "opportunity", "undergraduate", "student", "experience"]);

/** Collapses synonyms ("hci" and "human-computer interaction") into one interest. */
function canonical(term: string): string {
  const t = norm(term);
  if (SYNONYMS[t]) return t;
  for (const [k, vs] of Object.entries(SYNONYMS)) if (vs.includes(t)) return k;
  return t;
}

// ───────── helpers ─────────
function norm(s: string): string {
  return s.toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
}
function has(text: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}
function variants(term: string): string[] {
  const t = norm(term);
  return [t, ...(SYNONYMS[t] ?? [])];
}
function uniq(xs: (string | null | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => Boolean(x && x.trim())).map(norm))];
}
function list(xs: string[], n = 3): string {
  return xs.length <= n ? xs.join(", ") : `${xs.slice(0, n).join(", ")} +${xs.length - n} more`;
}
function fieldsIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const [f, kws] of Object.entries(FIELDS)) if (kws.some((k) => has(text, k))) out.add(f);
  return out;
}

/** Scores every opportunity for one student. `checks` = B's eligibility checks per opportunity. */
export function scoreAll(profile: Profile, opps: Opp[], checks: Map<string, Check[]>): Map<string, Relevance> {
  const texts = new Map(
    opps.map((o) => {
      const title = norm(o.title);
      const body = norm(
        [o.description, o.organization, o.deadline_text, ...(o.required_skills ?? []), ...(o.eligibility ?? []).map((r) => r.raw_text)].join(" "),
      );
      return [o.opportunity_id, { title, body, all: `${title} ${body}` }];
    }),
  );

  const display = new Map<string, string>();
  for (const raw of [...(profile.interests ?? []), ...(profile.research_areas ?? []), ...(profile.interest_keywords ?? [])]) {
    const c = canonical(raw);
    if (!c || GENERIC.has(c) || display.has(c)) continue;
    display.set(c, raw.trim());
  }
  const interestTerms = [...display.keys()];
  // IDF over this batch: rare words count more than words every listing uses.
  const N = opps.length || 1;
  const idf = new Map(
    interestTerms.map((t) => {
      const df = opps.filter((o) => variants(t).some((v) => has(texts.get(o.opportunity_id)!.all, v))).length;
      return [t, Math.log(1 + N / (1 + df))];
    }),
  );
  const skills = uniq(profile.skills ?? []);
  const majorField = MAJOR_TO_FIELD.find(([re]) => re.test(norm(profile.major ?? "")))?.[1] ?? null;
  const studentTerms = uniq(profile.available_terms ?? []).filter((t) => TERMS.includes(t));

  const out = new Map<string, Relevance>();
  for (const o of opps) {
    const tx = texts.get(o.opportunity_id)!;
    const signals: Signal[] = [];

    // 1. Topic match (35)
    if (interestTerms.length) {
      let got = 0;
      let total = 0;
      const hits: string[] = [];
      for (const t of interestTerms) {
        const w = idf.get(t) ?? 1;
        total += w;
        const v = variants(t);
        const s = v.some((x) => has(tx.title, x)) ? 1 : v.some((x) => has(tx.body, x)) ? 0.7 : 0;
        if (s > 0) hits.push(display.get(t) ?? t);
        got += w * s;
      }
      // Covering 60% of weighted interests already counts as a full topic match.
      const score = Math.min(1, total ? got / total / 0.6 : 0);
      signals.push({
        key: "topic",
        label: "Topic match",
        weight: 35,
        score,
        explanation: hits.length
          ? `Matches ${hits.length} of your ${interestTerms.length} interests: ${list(hits)}`
          : `None of your ${interestTerms.length} interests appear in this listing`,
      });
    }

    // 2. Skill coverage (25) — only when the listing names skills
    const wanted = [...new Map((o.required_skills ?? []).filter((x) => x.trim()).map((x) => [norm(x), x.trim()])).values()];
    if (wanted.length && skills.length) {
      const haveSet = new Set(skills.flatMap(variants));
      const got = wanted.filter((w) => variants(w).some((v) => haveSet.has(v) || [...haveSet].some((h) => has(v, h) || has(h, v))));
      const missing = wanted.filter((w) => !got.includes(w));
      signals.push({
        key: "skills",
        label: "Skill coverage",
        weight: 25,
        score: got.length / wanted.length,
        explanation: `You have ${got.length} of ${wanted.length} listed skills${missing.length ? `; missing: ${list(missing)}` : ""}`,
      });
    }

    // 3. Major relevance (15)
    const oppFields = fieldsIn(tx.all);
    if (majorField && oppFields.size) {
      const same = oppFields.has(majorField);
      const near = !same && (ADJACENT[majorField] ?? []).some((f) => oppFields.has(f));
      signals.push({
        key: "major",
        label: "Major relevance",
        weight: 15,
        score: same ? 1 : near ? 0.6 : 0.2,
        explanation: same
          ? "This listing is in your major's field"
          : near
            ? "Your major is closely related to this field"
            : "This listing is outside your major's usual field",
      });
    }

    // 4. Category preference (10)
    if (profile.selected_modules?.length) {
      const inIt = profile.selected_modules.includes(o.category);
      signals.push({
        key: "category",
        label: "Category preference",
        weight: 10,
        score: inIt ? 1 : 0,
        explanation: inIt ? "In a category you chose" : "Not in the categories you chose",
      });
    }

    // 5. Time fit (10)
    const parts: number[] = [];
    const bits: string[] = [];
    const hoursReq = o.eligibility?.find((r) => r.type === "hours_per_week" && typeof r.value === "number")?.value as number | undefined;
    const hoursText = tx.all.match(/(\d{1,2})\s*(?:\+\s*)?(?:hours?|hrs?)(?:\s*(?:per|a|\/)\s*week|\s*weekly)?/);
    const need = hoursReq ?? (hoursText ? Number(hoursText[1]) : undefined);
    if (need && profile.hours_per_week != null) {
      parts.push(Math.min(1, profile.hours_per_week / need));
      bits.push(profile.hours_per_week >= need ? `fits your ${profile.hours_per_week} hrs/week` : `asks ${need} hrs/week; you have ${profile.hours_per_week}`);
    }
    const oppTerms = TERMS.filter((t) => has(tx.all, t));
    if (oppTerms.length && studentTerms.length) {
      const overlap = oppTerms.filter((t) => studentTerms.includes(t));
      parts.push(overlap.length / oppTerms.length);
      bits.push(overlap.length ? `matches your ${overlap.join("/")} availability` : `runs in ${oppTerms.join("/")}, outside your availability`);
    }
    if (parts.length) {
      const s = parts.reduce((a, b) => a + b, 0) / parts.length;
      signals.push({ key: "time", label: "Time fit", weight: 10, score: s, explanation: bits.join("; ").replace(/^./, (c) => c.toUpperCase()) });
    }

    // 6. Preferred qualifications (5)
    const preferred = (o.eligibility ?? []).filter((r) => !r.is_hard_requirement);
    if (preferred.length) {
      const cs = checks.get(o.opportunity_id) ?? [];
      const met = preferred.filter((r) => cs.some((c) => c.type === r.type && (!c.raw_text || c.raw_text === r.raw_text) && c.result === "eligible")).length;
      signals.push({
        key: "preferred",
        label: "Preferred qualifications",
        weight: 5,
        score: met / preferred.length,
        explanation: `Meets ${met} of ${preferred.length} preferred qualification${preferred.length === 1 ? "" : "s"}`,
      });
    }

    const wsum = signals.reduce((a, s) => a + s.weight, 0);
    out.set(o.opportunity_id, {
      relevance_score: wsum ? Math.round((100 * signals.reduce((a, s) => a + s.weight * s.score, 0)) / wsum) : null,
      relevance_breakdown: signals,
      signals_used: signals.length,
      low_confidence: wsum < 40,
      algorithm_version: ALGORITHM_VERSION,
    });
  }
  return out;
}
