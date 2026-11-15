-- 006: a student's own calendar (classes, exams, work, time set aside for applications). Safe to rerun.
-- Saved-opportunity deadlines are NOT copied here; the calendar reads them live from saved_opportunities.
CREATE TABLE IF NOT EXISTS student_events (
  event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title          text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  kind           text NOT NULL CHECK (kind IN ('class', 'exam', 'work', 'application', 'interview', 'personal')),
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  repeat_weekly  boolean NOT NULL DEFAULT false,
  repeat_until   date,
  opportunity_id uuid REFERENCES opportunities(opportunity_id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at <= interval '24 hours')
);
CREATE INDEX IF NOT EXISTS student_events_user ON student_events (user_id, starts_at);
