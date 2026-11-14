// Shared enums and input validation — see docs/contracts.md §1–§3.

export const CATEGORIES = ["research", "internship", "event", "competition", "program", "course"] as const;
export const ACADEMIC_YEARS = ["freshman", "sophomore", "junior", "senior", "graduate"] as const;
export const APPLICATION_STATUSES = ["saved", "applying", "applied", "rejected", "accepted"] as const;
export const EXPERIENCE_TYPES = ["research", "internship", "project", "other"] as const;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

type Obj = Record<string, unknown>;

export function isObject(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Optional string: missing/null/"" → null. */
export function optString(o: Obj, field: string, max = 200): string | null {
  const v = o[field];
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new ValidationError(field, `${field} must be a string or null`);
  const s = v.trim();
  if (s.length > max) throw new ValidationError(field, `${field} must be at most ${max} characters`);
  return s === "" ? null : s;
}

/** String array: missing → []. Contract §0: arrays are never null. */
export function stringArray(o: Obj, field: string, maxItems = 50, maxLen = 100): string[] {
  const v = o[field];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
    throw new ValidationError(field, `${field} must be an array of strings`);
  const items = [...new Set((v as string[]).map((s) => s.trim()).filter(Boolean))];
  if (items.length > maxItems) throw new ValidationError(field, `${field} can have at most ${maxItems} items`);
  if (items.some((s) => s.length > maxLen))
    throw new ValidationError(field, `each item in ${field} must be at most ${maxLen} characters`);
  return items;
}

export function optEnum<T extends string>(o: Obj, field: string, allowed: readonly T[]): T | null {
  const v = o[field];
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !allowed.includes(v as T))
    throw new ValidationError(field, `${field} must be one of: ${allowed.join(", ")}`);
  return v as T;
}

export interface Experience {
  type: (typeof EXPERIENCE_TYPES)[number];
  title: string;
  organization: string | null;
  description: string | null;
}

export interface ProfileInput {
  university: string;
  major: string | null;
  minor: string | null;
  academic_year: (typeof ACADEMIC_YEARS)[number] | null;
  expected_graduation: string | null;
  courses_taken: string[];
  interests: string[];
  research_areas: string[];
  career_goals: string[];
  selected_modules: string[];
  skills: string[];
  experiences: Experience[];
  hours_per_week: number | null;
  available_terms: string[];
  work_authorization: string | null;
}

/** Validates a StudentProfile body (contracts §3). user_id/updated_at are ignored. */
export function parseProfileInput(body: unknown): ProfileInput {
  if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");

  const expected_graduation = optString(body, "expected_graduation", 7);
  if (expected_graduation && !/^\d{4}-(0[1-9]|1[0-2])$/.test(expected_graduation))
    throw new ValidationError("expected_graduation", "expected_graduation must be YYYY-MM");

  const selected_modules = stringArray(body, "selected_modules", CATEGORIES.length);
  if (selected_modules.some((c) => !(CATEGORIES as readonly string[]).includes(c)))
    throw new ValidationError("selected_modules", `selected_modules must only contain: ${CATEGORIES.join(", ")}`);

  const hoursRaw = body.hours_per_week;
  let hours_per_week: number | null = null;
  if (hoursRaw !== undefined && hoursRaw !== null) {
    if (typeof hoursRaw !== "number" || !Number.isInteger(hoursRaw) || hoursRaw < 0 || hoursRaw > 168)
      throw new ValidationError("hours_per_week", "hours_per_week must be an integer from 0 to 168, or null");
    hours_per_week = hoursRaw;
  }

  const expRaw = body.experiences ?? [];
  if (!Array.isArray(expRaw) || expRaw.length > 30)
    throw new ValidationError("experiences", "experiences must be an array (max 30)");
  const experiences: Experience[] = expRaw.map((e, i) => {
    if (!isObject(e)) throw new ValidationError(`experiences[${i}]`, "each experience must be an object");
    const type = optEnum(e, "type", EXPERIENCE_TYPES);
    const title = optString(e, "title");
    if (!type || !title)
      throw new ValidationError(`experiences[${i}]`, "each experience needs a valid type and a title");
    return {
      type,
      title,
      organization: optString(e, "organization"),
      description: optString(e, "description", 2000),
    };
  });

  return {
    university: optString(body, "university") ?? "UCSD",
    major: optString(body, "major"),
    minor: optString(body, "minor"),
    academic_year: optEnum(body, "academic_year", ACADEMIC_YEARS),
    expected_graduation,
    courses_taken: stringArray(body, "courses_taken", 100),
    interests: stringArray(body, "interests"),
    research_areas: stringArray(body, "research_areas"),
    career_goals: stringArray(body, "career_goals"),
    selected_modules,
    skills: stringArray(body, "skills"),
    experiences,
    hours_per_week,
    available_terms: stringArray(body, "available_terms", 12),
    // Only ever what the student typed in; never inferred (contracts §3).
    work_authorization: optString(body, "work_authorization"),
  };
}

// ───────────────────────── Opportunity ingest (contracts §2, §4.5) ─────────────────────────

export const OPPORTUNITY_STATUSES = ["verified", "needs_verification", "expired"] as const;
export const SOURCE_TYPES = ["lab_page", "department", "calendar", "listing", "other"] as const;
export const ELIGIBILITY_TYPES = [
  "academic_year", "major", "course", "skill", "hours_per_week",
  "duration", "work_authorization", "gpa", "other",
] as const;

export interface EligibilityRequirement {
  type: (typeof ELIGIBILITY_TYPES)[number];
  value: string | number | string[] | null;
  raw_text: string;
  is_hard_requirement: boolean;
}

export interface OpportunityInput {
  title: string;
  university: string;
  organization: string | null;
  category: (typeof CATEGORIES)[number];
  description: string | null;
  required_skills: string[];
  eligibility: EligibilityRequirement[];
  deadline: string | null;
  deadline_text: string | null;
  application_method: string | null;
  source_url: string;
  status: (typeof OPPORTUNITY_STATUSES)[number];
}

export function httpUrl(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length > 2000) throw new ValidationError(field, `${field} must be a URL string`);
  let u: URL;
  try {
    u = new URL(v.trim());
  } catch {
    throw new ValidationError(field, `${field} must be a valid URL`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new ValidationError(field, `${field} must start with http:// or https://`);
  u.hash = ""; // same page with different #anchors is the same opportunity
  return u.toString();
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Validates one extracted opportunity. Unknown values must be null/[] — never guessed. */
export function parseOpportunityInput(o: unknown): OpportunityInput {
  if (!isObject(o)) throw new ValidationError("opportunity", "each opportunity must be an object");

  const title = optString(o, "title", 300);
  if (!title) throw new ValidationError("title", "title is required");
  const category = optEnum(o, "category", CATEGORIES);
  if (!category) throw new ValidationError("category", `category is required (${CATEGORIES.join(", ")})`);

  const deadline = optString(o, "deadline", 10);
  if (deadline && !isRealDate(deadline))
    throw new ValidationError("deadline", "deadline must be a real date YYYY-MM-DD, or null with deadline_text");

  const eligRaw = o.eligibility ?? [];
  if (!Array.isArray(eligRaw) || eligRaw.length > 30)
    throw new ValidationError("eligibility", "eligibility must be an array (max 30)");
  const eligibility: EligibilityRequirement[] = eligRaw.map((e, i) => {
    const f = `eligibility[${i}]`;
    if (!isObject(e)) throw new ValidationError(f, `${f} must be an object`);
    const type = optEnum(e, "type", ELIGIBILITY_TYPES);
    if (!type) throw new ValidationError(`${f}.type`, `${f}.type must be one of: ${ELIGIBILITY_TYPES.join(", ")}`);
    const raw_text = optString(e, "raw_text", 1000);
    if (!raw_text) throw new ValidationError(`${f}.raw_text`, `${f}.raw_text (source evidence) is required`);
    const v = e.value;
    const okValue =
      v === null || v === undefined || typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) ||
      (Array.isArray(v) && v.every((x) => typeof x === "string"));
    if (!okValue) throw new ValidationError(`${f}.value`, `${f}.value must be string, number, string[] or null`);
    if (typeof e.is_hard_requirement !== "boolean")
      throw new ValidationError(`${f}.is_hard_requirement`, `${f}.is_hard_requirement must be true or false`);
    return { type, value: (v ?? null) as EligibilityRequirement["value"], raw_text, is_hard_requirement: e.is_hard_requirement };
  });

  return {
    title,
    university: optString(o, "university", 100) ?? "UCSD",
    organization: optString(o, "organization", 300),
    category,
    description: optString(o, "description", 5000),
    required_skills: stringArray(o, "required_skills"),
    eligibility,
    deadline,
    deadline_text: optString(o, "deadline_text", 200),
    application_method: optString(o, "application_method", 1000),
    source_url: httpUrl(o.source_url, "source_url"),
    status: optEnum(o, "status", OPPORTUNITY_STATUSES) ?? "needs_verification",
  };
}
