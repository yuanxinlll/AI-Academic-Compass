-- 005: students can report a listing that looks wrong. Reviewers resolve reports. Safe to rerun.
CREATE TABLE IF NOT EXISTS opportunity_reports (
  report_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(user_id) ON DELETE SET NULL,
  reason         text NOT NULL CHECK (reason IN ('closed', 'deadline', 'requirements', 'who_can_apply', 'link', 'other')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);
CREATE INDEX IF NOT EXISTS opportunity_reports_open ON opportunity_reports (created_at DESC) WHERE resolved_at IS NULL;
