// Calendar rules. Run: node --experimental-strip-types tests/calendar.test.mts
import assert from "node:assert/strict";
import { expand, findConflicts, warnings, deadlinesFrom, monthGrid, type StudentEvent } from "../lib/client/calendar.ts";

const ev = (id: string, s: string, e: string, extra: Partial<StudentEvent> = {}): StudentEvent => ({
  event_id: id, title: id, kind: "class", starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(),
  repeat_weekly: false, repeat_until: null, opportunity_id: null, notes: null, ...extra,
});
const range = (a: string, b: string) => [new Date(a), new Date(b)] as const;
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ok ", name); };

t("overlap is a conflict", () => {
  const o = expand([ev("a", "2026-11-17T10:00", "2026-11-17T11:00"), ev("b", "2026-11-17T10:30", "2026-11-17T12:00")], ...range("2026-11-01", "2026-12-01"));
  assert.equal(findConflicts(o).length, 1);
});
t("back-to-back is not a conflict", () => {
  const o = expand([ev("a", "2026-11-17T10:00", "2026-11-17T11:00"), ev("b", "2026-11-17T11:00", "2026-11-17T12:00")], ...range("2026-11-01", "2026-12-01"));
  assert.equal(findConflicts(o).length, 0);
});
t("weekly class repeats until repeat_until, inclusive", () => {
  const o = expand([ev("c", "2026-11-03T14:00", "2026-11-03T15:20", { repeat_weekly: true, repeat_until: "2026-11-24" })], ...range("2026-11-01", "2027-01-01"));
  assert.deepEqual(o.map((x) => x.start.getDate()), [3, 10, 17, 24]);
});
t("weekly class keeps its wall-clock time across a DST change", () => {
  const o = expand([ev("c", "2026-10-27T14:00", "2026-10-27T15:00", { repeat_weekly: true })], ...range("2026-10-20", "2026-11-20"));
  assert.ok(o.every((x) => x.start.getHours() === 14));
});
t("an interview that hits a weekly class three weeks later is caught", () => {
  const o = expand([
    ev("class", "2026-11-03T14:00", "2026-11-03T15:20", { repeat_weekly: true }),
    ev("interview", "2026-11-24T15:00", "2026-11-24T15:30", { kind: "interview" }),
  ], ...range("2026-11-01", "2026-12-01"));
  const c = findConflicts(o);
  assert.equal(c.length, 1);
  assert.deepEqual([c[0].a.event.event_id, c[0].b.event.event_id].sort(), ["class", "interview"]);
});
const bm = (id: string, deadline: string | null, status = "saved") => ({
  opportunity: { opportunity_id: id, title: id, deadline, status: "needs_verification" }, application_status: status, updated_at: "",
}) as never;
t("deadline crunch: 2+ open deadlines within 3 days", () => {
  const d = deadlinesFrom([bm("x", "2026-12-01"), bm("y", "2026-12-03"), bm("z", "2026-12-20"), bm("n", null)]);
  const w = warnings([], d);
  assert.equal(w.length, 1);
  assert.equal(w[0].kind, "crunch");
});
t("applied and rejected listings do not count toward a crunch", () => {
  const d = deadlinesFrom([bm("x", "2026-12-01", "applied"), bm("y", "2026-12-02"), bm("r", "2026-12-02", "rejected")]);
  assert.equal(warnings([], d).length, 0);
});
t("exam on a deadline day is flagged", () => {
  const o = expand([ev("final", "2026-12-08T08:00", "2026-12-08T11:00", { kind: "exam" })], ...range("2026-12-01", "2027-01-01"));
  const w = warnings(o, deadlinesFrom([bm("x", "2026-12-08")]));
  assert.ok(w.some((x) => x.kind === "exam_deadline"));
});
t("month grid starts on Sunday and has 42 days", () => {
  const g = monthGrid(2026, 10);
  assert.equal(g.length, 42);
  assert.equal(new Date(`${g[0]}T00:00`).getDay(), 0);
  assert.ok(g.includes("2026-11-01") && g.includes("2026-11-30"));
});
console.log(`\n${n} calendar tests passed`);
