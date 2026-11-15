// Calendar logic for the student calendar. Pure functions (no React, no fetch) so they can be unit-tested.
import type { Bookmark } from "./types";

export const EVENT_KINDS = ["class", "exam", "work", "application", "interview", "personal"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  class: "Class",
  exam: "Exam",
  work: "Work shift",
  application: "Application work",
  interview: "Interview / meeting",
  personal: "Personal",
};

export type StudentEvent = {
  event_id: string;
  title: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string;
  repeat_weekly: boolean;
  repeat_until: string | null; // YYYY-MM-DD, inclusive
  opportunity_id: string | null;
  notes: string | null;
};

export type Occurrence = { key: string; event: StudentEvent; start: Date; end: Date };
export type Deadline = { key: string; date: string; bookmark: Bookmark };
export type Conflict = { a: Occurrence; b: Occurrence };
export type Warning =
  | { kind: "overlap"; conflict: Conflict }
  | { kind: "crunch"; deadlines: Deadline[] }
  | { kind: "exam_deadline"; deadline: Deadline; exam: Occurrence };

/** Local calendar date YYYY-MM-DD of a Date (the viewer's own time zone). */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Adds whole days in local time, so a weekly 2pm class stays at 2pm across daylight-saving changes. */
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Every occurrence of the events that touches [from, to). Weekly events repeat until repeat_until (inclusive). */
export function expand(events: StudentEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    const len = end.getTime() - start.getTime();
    if (!e.repeat_weekly) {
      if (end > from && start < to) out.push({ key: e.event_id, event: e, start, end });
      continue;
    }
    const until = e.repeat_until ? new Date(`${e.repeat_until}T23:59:59`) : null;
    // Jump close to `from` instead of walking from the first week.
    const skip = Math.max(0, Math.floor((from.getTime() - end.getTime()) / (7 * 864e5)));
    for (let i = skip; i < skip + 400; i++) {
      const s = addDays(start, 7 * i);
      if (s >= to || (until && s > until)) break;
      const f = new Date(s.getTime() + len);
      if (f > from) out.push({ key: `${e.event_id}#${i}`, event: e, start: s, end: f });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
}

/** Pairs of occurrences whose times overlap. Touching (one ends as the next starts) is not a conflict. */
export function findConflicts(occ: Occurrence[]): Conflict[] {
  const sorted = [...occ].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Conflict[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) {
      out.push({ a: sorted[i], b: sorted[j] });
    }
  }
  return out;
}

/** Saved listings that have a real date, still open in the student's tracker (not rejected/accepted). */
export function deadlinesFrom(bookmarks: Bookmark[]): Deadline[] {
  return bookmarks
    .filter((b) => b.opportunity.deadline && b.opportunity.status !== "expired" && !["rejected", "accepted"].includes(b.application_status))
    .map((b) => ({ key: `d:${b.opportunity.opportunity_id}`, date: b.opportunity.deadline!.slice(0, 10), bookmark: b }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}

/**
 * Heads-up list, in date order:
 * - overlap: two of the student's own events at the same time
 * - crunch: 2+ unfinished deadlines within 3 days of each other
 * - exam_deadline: a deadline on the same day as one of the student's exams
 */
export function warnings(occ: Occurrence[], deadlines: Deadline[], windowDays = 3): Warning[] {
  const out: Warning[] = findConflicts(occ).map((conflict) => ({ kind: "overlap" as const, conflict }));
  const open = deadlines.filter((d) => d.bookmark.application_status !== "applied");
  for (let i = 0; i < open.length; ) {
    let j = i + 1;
    while (j < open.length && dayDiff(open[j - 1].date, open[j].date) <= windowDays) j++;
    if (j - i >= 2) out.push({ kind: "crunch", deadlines: open.slice(i, j) });
    i = j;
  }
  for (const d of open) {
    const exam = occ.find((o) => o.event.kind === "exam" && localDay(o.start) === d.date);
    if (exam) out.push({ kind: "exam_deadline", deadline: d, exam });
  }
  const when = (w: Warning) =>
    w.kind === "overlap" ? localDay(w.conflict.a.start) : w.kind === "crunch" ? w.deadlines[0].date : w.deadline.date;
  return out.sort((a, b) => when(a).localeCompare(when(b)));
}

/** The 6×7 grid of local dates for a month view, weeks starting Sunday. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => localDay(addDays(start, i)));
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
export function fmtDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
