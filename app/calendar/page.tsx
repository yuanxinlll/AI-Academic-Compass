"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, createEvent, deleteEvent, getBookmarks, getCalendar, updateEvent, type EventDraft } from "@/lib/client/api";
import {
  EVENT_KINDS,
  EVENT_KIND_LABELS,
  deadlinesFrom,
  expand,
  findConflicts,
  fmtDay,
  fmtTime,
  localDay,
  monthGrid,
  warnings,
  type Deadline,
  type EventKind,
  type Occurrence,
  type StudentEvent,
  type Warning,
} from "@/lib/client/calendar";
import type { Bookmark } from "@/lib/client/types";
import NavBar from "../components/nav-bar";
import { RequireSignIn } from "../components/session";

type Form = {
  id: string | null;
  title: string;
  kind: EventKind;
  day: string;
  start: string;
  end: string;
  repeat: boolean;
  until: string;
  opportunity_id: string;
  notes: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function blankForm(day: string): Form {
  return { id: null, title: "", kind: "class", day, start: "10:00", end: "11:00", repeat: false, until: "", opportunity_id: "", notes: "" };
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toDraft(f: Form): EventDraft {
  const starts = new Date(`${f.day}T${f.start}`);
  let ends = new Date(`${f.day}T${f.end}`);
  if (ends <= starts) ends = new Date(ends.getTime() + 864e5); // e.g. a night shift 22:00–02:00
  return {
    title: f.title.trim(),
    kind: f.kind,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    repeat_weekly: f.repeat,
    repeat_until: f.repeat && f.until ? f.until : null,
    opportunity_id: f.opportunity_id || null,
    notes: f.notes.trim() || null,
  };
}

function WarningLine({ w, onEdit }: { w: Warning; onEdit: (e: StudentEvent, at: Date) => void }) {
  if (w.kind === "overlap") {
    const { a, b } = w.conflict;
    return (
      <li className="ac-cal-warn ac-cal-warn-red">
        <strong>Time conflict · {fmtDay(localDay(a.start))}</strong>
        <span>
          <button type="button" className="ac-linkbtn" onClick={() => onEdit(a.event, a.start)}>
            {a.event.title}
          </button>{" "}
          ({fmtTime(a.start)}–{fmtTime(a.end)}) overlaps{" "}
          <button type="button" className="ac-linkbtn" onClick={() => onEdit(b.event, b.start)}>
            {b.event.title}
          </button>{" "}
          ({fmtTime(b.start)}–{fmtTime(b.end)}).
        </span>
      </li>
    );
  }
  if (w.kind === "crunch") {
    return (
      <li className="ac-cal-warn ac-cal-warn-amber">
        <strong>
          {w.deadlines.length} deadlines in {fmtDay(w.deadlines[0].date)} – {fmtDay(w.deadlines[w.deadlines.length - 1].date)}
        </strong>
        <span>
          {w.deadlines.map((d, i) => (
            <span key={d.key}>
              {i ? ", " : ""}
              <Link href={`/opportunities/${d.bookmark.opportunity.opportunity_id}`}>{d.bookmark.opportunity.title}</Link>
            </span>
          ))}
          . Block out time for applications before this stretch.
        </span>
      </li>
    );
  }
  return (
    <li className="ac-cal-warn ac-cal-warn-amber">
      <strong>Exam on a deadline day · {fmtDay(w.deadline.date)}</strong>
      <span>
        {w.exam.event.title} is on the same day{" "}
        <Link href={`/opportunities/${w.deadline.bookmark.opportunity.opportunity_id}`}>{w.deadline.bookmark.opportunity.title}</Link> is
        due. Try to submit early.
      </span>
    </li>
  );
}

function CalendarInner() {
  const today = localDay(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<StudentEvent[] | null>(null);
  const [saved, setSaved] = useState<Bookmark[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCalendar()
      .then(setEvents)
      .catch((e) => {
        setEvents([]);
        setError(e instanceof ApiError ? e.message : "Could not load your calendar.");
      });
    getBookmarks().then(setSaved).catch(() => undefined);
  }, []);

  const grid = monthGrid(cursor.y, cursor.m);
  const from = new Date(`${grid[0]}T00:00:00`);
  const to = new Date(new Date(`${grid[41]}T00:00:00`).getTime() + 864e5);
  const occ = expand(events ?? [], from, to);
  const deadlines = useMemo(() => deadlinesFrom(saved), [saved]);

  // Heads-up looks ahead from today, not just the visible month.
  const ahead = useMemo(() => {
    const start = new Date(`${today}T00:00:00`);
    const end = new Date(start.getTime() + 60 * 864e5);
    return warnings(
      expand(events ?? [], start, end),
      deadlines.filter((d) => d.date >= today && d.date <= localDay(end)),
    );
  }, [events, deadlines, today]);

  const conflictKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of findConflicts(occ)) {
      s.add(c.a.key);
      s.add(c.b.key);
    }
    return s;
  }, [occ]);

  const byDay = useMemo(() => {
    const m = new Map<string, { occ: Occurrence[]; due: Deadline[] }>();
    const get = (d: string) => m.get(d) ?? (m.set(d, { occ: [], due: [] }), m.get(d)!);
    for (const o of occ) get(localDay(o.start)).occ.push(o);
    for (const d of deadlines) get(d.date).due.push(d);
    return m;
  }, [occ, deadlines]);

  function openEdit(e: StudentEvent, at: Date) {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    setForm({
      id: e.event_id,
      title: e.title,
      kind: e.kind,
      day: localDay(e.repeat_weekly ? start : at),
      start: hhmm(start),
      end: hhmm(end),
      repeat: e.repeat_weekly,
      until: e.repeat_until ?? "",
      opportunity_id: e.opportunity_id ?? "",
      notes: e.notes ?? "",
    });
  }

  function planFor(d: Deadline) {
    const [y, m, dd] = d.date.split("-").map(Number);
    const day = localDay(new Date(y, m - 1, dd - 3));
    setForm({
      ...blankForm(day < today ? today : day),
      kind: "application",
      title: `Work on: ${d.bookmark.opportunity.title}`.slice(0, 120),
      start: "16:00",
      end: "18:00",
      opportunity_id: d.bookmark.opportunity.opportunity_id,
    });
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim()) return setError("Give the event a name.");
    setBusy(true);
    setError(null);
    try {
      const draft = toDraft(form);
      if (form.id) {
        const updated = await updateEvent(form.id, draft);
        setEvents((list) => (list ?? []).map((x) => (x.event_id === updated.event_id ? updated : x)));
      } else {
        const created = await createEvent(draft);
        setEvents((list) => [...(list ?? []), created]);
      }
      setSelected(form.day);
      setForm(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save that event.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!form?.id) return;
    setBusy(true);
    try {
      await deleteEvent(form.id);
      setEvents((list) => (list ?? []).filter((x) => x.event_id !== form.id));
      setForm(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete that event.");
    } finally {
      setBusy(false);
    }
  }

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const day = byDay.get(selected) ?? { occ: [], due: [] };
  const draftConflicts = useMemo(() => {
    if (!form || !form.title.trim() || !form.day) return [];
    try {
      const draft = toDraft(form);
      const mine = { ...draft, event_id: form.id ?? "draft", repeat_until: draft.repeat_until } as StudentEvent;
      const s = new Date(draft.starts_at);
      const others = expand((events ?? []).filter((x) => x.event_id !== form.id), s, new Date(s.getTime() + (form.repeat ? 120 : 1) * 864e5));
      const me = expand([mine], s, new Date(s.getTime() + (form.repeat ? 120 : 1) * 864e5));
      return findConflicts([...others, ...me]).filter((c) => (c.a.event.event_id === mine.event_id) !== (c.b.event.event_id === mine.event_id));
    } catch {
      return [];
    }
  }, [form, events]);

  return (
    <>
      <NavBar />
      <main className="ac-page">
        <section className="ac-section">
          <div className="ac-section-head">
            <div>
              <p className="ac-eyebrow">Plan</p>
              <h1 className="ac-h1">Calendar</h1>
            </div>
            <button type="button" className="ac-btn ac-btn-primary" onClick={() => setForm(blankForm(selected))}>
              + Add event
            </button>
          </div>
          <p className="ac-muted">
            Deadlines of the listings you save show up here on their own. Add your classes, exams and work shifts, and we&apos;ll flag
            anything that clashes.
          </p>
          {error ? <p className="ac-error">{error}</p> : null}
        </section>

        <section className="ac-panel-card ac-cal-heads">
          <h2>Heads up · next 60 days</h2>
          {events === null ? (
            <p className="ac-muted">Loading…</p>
          ) : ahead.length ? (
            <ul className="ac-cal-warns">
              {ahead.slice(0, 8).map((w, i) => (
                <WarningLine key={i} w={w} onEdit={openEdit} />
              ))}
            </ul>
          ) : (
            <p className="ac-muted">No clashes or deadline pile-ups coming up.</p>
          )}
        </section>

        <section className="ac-panel-card ac-cal">
          <div className="ac-cal-bar">
            <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" aria-label="Previous month" onClick={() => setCursor((c) => (c.m ? { y: c.y, m: c.m - 1 } : { y: c.y - 1, m: 11 }))}>
              ‹
            </button>
            <h2>{monthName}</h2>
            <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" aria-label="Next month" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}>
              ›
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-sm"
              onClick={() => {
                const d = new Date();
                setCursor({ y: d.getFullYear(), m: d.getMonth() });
                setSelected(today);
              }}
            >
              Today
            </button>
          </div>
          <div className="ac-cal-grid" role="grid" aria-label={monthName}>
            {WEEKDAYS.map((w) => (
              <div key={w} className="ac-cal-wd" role="columnheader">
                {w}
              </div>
            ))}
            {grid.map((d) => {
              const cell = byDay.get(d);
              const inMonth = Number(d.slice(5, 7)) - 1 === cursor.m;
              const clash = cell?.occ.some((o) => conflictKeys.has(o.key));
              const items = [
                ...(cell?.due ?? []).map((x) => ({ key: x.key, label: x.bookmark.opportunity.title, cls: x.bookmark.application_status === "applied" ? "is-done" : "is-due" })),
                ...(cell?.occ ?? []).map((o) => ({ key: o.key, label: `${fmtTime(o.start)} ${o.event.title}`, cls: `is-${o.event.kind}${conflictKeys.has(o.key) ? " is-clash" : ""}` })),
              ];
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  className={`ac-cal-day${inMonth ? "" : " is-out"}${d === today ? " is-today" : ""}${d === selected ? " is-sel" : ""}${clash ? " has-clash" : ""}`}
                  onClick={() => setSelected(d)}
                  onDoubleClick={() => setForm(blankForm(d))}
                  aria-label={`${fmtDay(d)}${items.length ? `, ${items.length} items` : ""}${clash ? ", has a conflict" : ""}`}
                >
                  <span className="ac-cal-num">{Number(d.slice(8))}</span>
                  {items.slice(0, 3).map((it) => (
                    <span key={it.key} className={`ac-cal-chip ${it.cls}`}>
                      {it.label}
                    </span>
                  ))}
                  {items.length > 3 ? <span className="ac-cal-more">+{items.length - 3} more</span> : null}
                </button>
              );
            })}
          </div>
          <p className="ac-fineprint">
            <span className="ac-cal-key is-due" /> deadline · <span className="ac-cal-key is-class" /> your events ·{" "}
            <span className="ac-cal-key is-clash" /> time conflict. Double-click a day to add an event.
          </p>
        </section>

        <section className="ac-panel-card">
          <div className="ac-section-head">
            <h2>{fmtDay(selected)}</h2>
            <button type="button" className="ac-btn ac-btn-sm" onClick={() => setForm(blankForm(selected))}>
              + Add on this day
            </button>
          </div>
          {!day.due.length && !day.occ.length ? <p className="ac-muted">Nothing on this day.</p> : null}
          <ul className="ac-saved">
            {day.due.map((d) => (
              <li key={d.key}>
                <div className="ac-saved-main">
                  <Link href={`/opportunities/${d.bookmark.opportunity.opportunity_id}`} className="ac-saved-title">
                    Deadline: {d.bookmark.opportunity.title}
                  </Link>
                  <span className="ac-muted">
                    {d.bookmark.opportunity.deadline_text ? `“${d.bookmark.opportunity.deadline_text.slice(0, 120)}”` : "From the source page"}
                  </span>
                </div>
                <span className={`ac-tag ${d.bookmark.application_status === "applied" ? "ac-tone-green" : "ac-tone-red"}`}>
                  {d.bookmark.application_status === "applied" ? "Applied" : "Due"}
                </span>
                {d.bookmark.application_status !== "applied" ? (
                  <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={() => planFor(d)}>
                    Plan time
                  </button>
                ) : null}
              </li>
            ))}
            {day.occ.map((o) => (
              <li key={o.key} className={conflictKeys.has(o.key) ? "is-clash" : ""}>
                <div className="ac-saved-main">
                  <span className="ac-saved-title">{o.event.title}</span>
                  <span className="ac-muted">
                    {fmtTime(o.start)}–{fmtTime(o.end)} · {EVENT_KIND_LABELS[o.event.kind]}
                    {o.event.repeat_weekly ? " · weekly" : ""}
                    {conflictKeys.has(o.key) ? " · overlaps another event" : ""}
                  </span>
                </div>
                <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={() => openEdit(o.event, o.start)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {form ? (
        <div className="ac-modal-root" role="dialog" aria-modal="true" aria-label={form.id ? "Edit event" : "Add event"}>
          <div className="ac-panel-backdrop" onClick={() => setForm(null)} />
          <form
            className="ac-modal ac-panel-card"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <h2>{form.id ? "Edit event" : "Add event"}</h2>
            <label className="ac-field">
              <span>Name</span>
              <input className="ac-input" value={form.title} maxLength={120} autoFocus placeholder="e.g. CSE 100 lecture" onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="ac-field">
              <span>Type</span>
              <select className="ac-select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}>
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EVENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="ac-field-row">
              <label className="ac-field">
                <span>{form.repeat ? "First day" : "Day"}</span>
                <input className="ac-input" type="date" required value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
              </label>
              <label className="ac-field">
                <span>Start</span>
                <input className="ac-input" type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label className="ac-field">
                <span>End</span>
                <input className="ac-input" type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>
            <label className="ac-switch">
              <input type="checkbox" checked={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.checked })} />
              <span>Repeats every week</span>
            </label>
            {form.repeat ? (
              <label className="ac-field">
                <span>Until (optional, e.g. end of quarter)</span>
                <input className="ac-input" type="date" value={form.until} min={form.day} onChange={(e) => setForm({ ...form, until: e.target.value })} />
              </label>
            ) : null}
            <label className="ac-field">
              <span>For a saved listing (optional)</span>
              <select className="ac-select" value={form.opportunity_id} onChange={(e) => setForm({ ...form, opportunity_id: e.target.value })}>
                <option value="">None</option>
                {saved.map((b) => (
                  <option key={b.opportunity.opportunity_id} value={b.opportunity.opportunity_id}>
                    {b.opportunity.title.slice(0, 70)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ac-field">
              <span>Notes (optional)</span>
              <textarea className="ac-input" rows={2} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {draftConflicts.length ? (
              <p className="ac-cal-warn ac-cal-warn-red" role="status">
                <strong>This overlaps {draftConflicts.length === 1 ? "another event" : `${draftConflicts.length} other times`}</strong>
                <span>
                  {(() => {
                    const c = draftConflicts[0];
                    const other = c.a.event.event_id === (form.id ?? "draft") ? c.b : c.a;
                    return `${other.event.title}, ${fmtDay(localDay(other.start))} ${fmtTime(other.start)}–${fmtTime(other.end)}. You can still save it.`;
                  })()}
                </span>
              </p>
            ) : null}
            {error ? <p className="ac-error">{error}</p> : null}
            <div className="ac-detail-actions">
              <button type="submit" className="ac-btn ac-btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" className="ac-btn ac-btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              {form.id ? (
                <button type="button" className="ac-btn ac-btn-danger" onClick={remove} disabled={busy}>
                  Delete{form.repeat ? " all weeks" : ""}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export default function CalendarPage() {
  return (
    <RequireSignIn>
      <CalendarInner />
    </RequireSignIn>
  );
}
