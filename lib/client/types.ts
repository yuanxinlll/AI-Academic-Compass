// Shared types for the frontend — mirrors docs/contracts.md (§1–§4).
// Enum values come from lib/validation.ts so frontend and backend never drift.
import {
  ACADEMIC_YEARS,
  APPLICATION_STATUSES,
  CATEGORIES,
  ELIGIBILITY_TYPES,
  EXPERIENCE_TYPES,
  OPPORTUNITY_STATUSES,
} from "@/lib/validation";

export { ACADEMIC_YEARS, APPLICATION_STATUSES, CATEGORIES, OPPORTUNITY_STATUSES };

export type Category = (typeof CATEGORIES)[number];
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export type AcademicYear = (typeof ACADEMIC_YEARS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type EligibilityType = (typeof ELIGIBILITY_TYPES)[number];
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

/** Result of matching ONE student to ONE opportunity (computed live, never stored). */
export type EligibilityStatus = "eligible" | "ineligible" | "needs_confirmation";

// ───────── Opportunity (§2) ─────────
export interface EligibilityRequirement {
  type: EligibilityType;
  value: string | number | string[] | null;
  raw_text: string; // exact quote from the source page — show this to students
  is_hard_requirement: boolean; // false = "preferred"
}

export interface Opportunity {
  opportunity_id: string;
  title: string;
  university: string;
  organization: string | null;
  category: Category;
  description: string | null;
  required_skills: string[];
  eligibility: EligibilityRequirement[];
  deadline: string | null; // "YYYY-MM-DD"
  deadline_text: string | null; // e.g. "Rolling basis" — show when deadline is null
  application_method: string | null;
  source_url: string;
  source_id: string | null;
  first_collected_at: string; // use this for "newest"
  last_verified_at: string;
  status: OpportunityStatus; // is the RECORD checked? (not the student's eligibility)
}

export interface OpportunityList {
  items: Opportunity[];
  total: number;
  page: number;
  limit: number;
}

// ───────── Student profile (§3) ─────────
export interface Experience {
  type: ExperienceType;
  title: string;
  organization: string | null;
  description: string | null;
}

export interface StudentProfile {
  user_id: string;
  university: string;
  major: string | null;
  minor: string | null;
  academic_year: AcademicYear | null;
  expected_graduation: string | null; // "YYYY-MM"
  courses_taken: string[];
  interests: string[];
  research_areas: string[];
  career_goals: string[];
  selected_modules: Category[];
  skills: string[];
  experiences: Experience[];
  hours_per_week: number | null;
  available_terms: string[];
  work_authorization: string | null; // only what the student typed — never inferred
  updated_at: string;
}

/** What the browser sends to POST /api/profile (server fills user_id/updated_at). */
export type StudentProfileInput = Omit<StudentProfile, "user_id" | "updated_at">;

// ───────── Matching (§4.4) ─────────
export interface EligibilityCheck {
  type: EligibilityType;
  result: EligibilityStatus;
  reason: string;
  raw_text?: string;
}

export interface MatchResult {
  opportunity_id: string;
  eligibility: { status: EligibilityStatus; checks: EligibilityCheck[] };
  relevance_score: number | null; // 0–100 relevance, NOT chance of acceptance
  explanation: string;
  reasons?: string[];
  questions_to_confirm?: string[];
}

/** An opportunity plus (optionally) this student's match result. */
export type OpportunityView = Opportunity & { match?: MatchResult };

// ───────── Bookmarks (§4.6) ─────────
export interface Bookmark {
  opportunity: Opportunity;
  application_status: ApplicationStatus;
  updated_at: string;
}

// ───────── Display labels ─────────
export const CATEGORY_LABELS: Record<Category, string> = {
  research: "Research",
  internship: "Internship",
  event: "Academic event",
  competition: "Competition",
  program: "Academic program",
  course: "Courses & learning",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  verified: "Verified",
  needs_verification: "Not yet verified",
  expired: "Expired",
};

export const ELIGIBILITY_STATUS_LABELS: Record<EligibilityStatus, string> = {
  eligible: "Eligible",
  ineligible: "Not eligible",
  needs_confirmation: "Needs confirmation",
};

export const ACADEMIC_YEAR_LABELS: Record<AcademicYear, string> = {
  freshman: "First year",
  sophomore: "Second year",
  junior: "Third year",
  senior: "Fourth year+",
  graduate: "Graduate student",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applying: "Applying",
  applied: "Applied",
  rejected: "Rejected",
  accepted: "Accepted",
};
