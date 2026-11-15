// Display rules from the plan's "UI design" section. Pure functions — no React.
import type { MatchResult, Opportunity } from "@/lib/client/types";

export type Tone = "green" | "teal" | "amber" | "orange" | "red" | "muted";

export type EligibilityBadge = {
  label: string;
  /** Short second line, e.g. "Listing not yet verified". */
  detail?: string;
  tone: Tone;
  verified: boolean;
};

/**
 * Eligibility badge for a signed-in student. Returns null when there is no match result
 * (signed out, no profile, or the AI service was unavailable) — then we show nothing.
 */
export function eligibilityBadge(o: Opportunity, match: MatchResult | undefined): EligibilityBadge | null {
  if (!match) return null;
  const verified = o.status === "verified";
  const { status, checks } = match.eligibility;
  if (status === "eligible") return { label: "Eligible", detail: "Verified listing", tone: "green", verified: true };
  if (status === "ineligible")
    return verified
      ? { label: "Not eligible", tone: "red", verified }
      : { label: "Likely not eligible", detail: "Listing not yet verified", tone: "orange", verified };
  // needs_confirmation
  const open = checks.filter((c) => c.result === "needs_confirmation").length;
  if (open === 0 && !verified)
    return { label: "Likely eligible", detail: "Listing not yet verified", tone: "teal", verified };
  return {
    label: "Check requirements",
    detail: open > 0 ? `Confirm ${open} requirement${open === 1 ? "" : "s"}` : undefined,
    tone: "amber",
    verified,
  };
}

/** Today's date in San Diego as YYYY-MM-DD (deadlines are campus-local dates). */
export function todayPacific(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export type DeadlineBadge = { label: string; tone: Tone } | null;

export function deadlineBadge(o: Pick<Opportunity, "deadline" | "deadline_text" | "status">, today = todayPacific()): DeadlineBadge {
  if (o.status === "expired") return { label: "Closed", tone: "muted" };
  if (!o.deadline) {
    const t = o.deadline_text?.trim();
    if (!t) return null;
    if (/rolling/i.test(t)) return { label: "Rolling deadline", tone: "muted" };
    return { label: t.length > 32 ? `${t.slice(0, 31)}…` : t, tone: "muted" };
  }
  const d = daysBetween(today, o.deadline);
  if (d < 0) return { label: "Closed", tone: "muted" };
  if (d === 0) return { label: "Closes today", tone: "red" };
  if (d === 1) return { label: "Closes tomorrow", tone: "red" };
  if (d <= 7) return { label: `Closes in ${d} days`, tone: "red" };
  if (d <= 14) return { label: `${d} days left`, tone: "amber" };
  return { label: `Due ${formatDate(o.deadline)}`, tone: "muted" };
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = y === Number(todayPacific().slice(0, 4));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric", timeZone: "UTC" });
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const REQUIREMENT_LABELS: Record<string, string> = {
  academic_year: "Class standing",
  major: "Major",
  course: "Courses",
  skill: "Skills",
  hours_per_week: "Hours per week",
  duration: "Duration",
  work_authorization: "Work authorization",
  gpa: "GPA",
  other: "Other",
};
