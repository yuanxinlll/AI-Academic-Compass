import { UUID_RE, ValidationError, isObject } from "@/lib/validation";

export const EVENT_KINDS = ["class", "exam", "work", "application", "interview", "personal"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type EventInput = {
  title: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string;
  repeat_weekly: boolean;
  repeat_until: string | null;
  opportunity_id: string | null;
  notes: string | null;
};

function isoTime(v: unknown, field: string): string {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new ValidationError(field, `${field} must be an ISO date-time`);
  return new Date(v).toISOString();
}

/** Validates a create/update body. Rules match the CHECK constraints in migration 006. */
export function parseEvent(b: unknown): EventInput {
  if (!isObject(b)) throw new ValidationError("body", "Request body must be a JSON object");
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 120) throw new ValidationError("title", "title is required (1–120 characters)");
  if (typeof b.kind !== "string" || !(EVENT_KINDS as readonly string[]).includes(b.kind))
    throw new ValidationError("kind", `kind must be one of: ${EVENT_KINDS.join(", ")}`);
  const starts_at = isoTime(b.starts_at, "starts_at");
  const ends_at = isoTime(b.ends_at, "ends_at");
  const ms = Date.parse(ends_at) - Date.parse(starts_at);
  if (ms <= 0) throw new ValidationError("ends_at", "The end must be after the start");
  if (ms > 24 * 3600 * 1000) throw new ValidationError("ends_at", "An event can be at most 24 hours long");
  const repeat_weekly = b.repeat_weekly === true;
  let repeat_until: string | null = null;
  if (repeat_weekly && b.repeat_until != null && b.repeat_until !== "") {
    if (typeof b.repeat_until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.repeat_until))
      throw new ValidationError("repeat_until", "repeat_until must be YYYY-MM-DD");
    if (b.repeat_until < starts_at.slice(0, 10)) throw new ValidationError("repeat_until", "Repeat end is before the first event");
    repeat_until = b.repeat_until;
  }
  let opportunity_id: string | null = null;
  if (b.opportunity_id != null && b.opportunity_id !== "") {
    if (typeof b.opportunity_id !== "string" || !UUID_RE.test(b.opportunity_id))
      throw new ValidationError("opportunity_id", "opportunity_id must be a UUID");
    opportunity_id = b.opportunity_id;
  }
  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 500) : null;
  return { title, kind: b.kind as EventKind, starts_at, ends_at, repeat_weekly, repeat_until, opportunity_id, notes };
}
