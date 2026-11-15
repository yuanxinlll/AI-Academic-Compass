-- 007: provenance per listing + an append-only audit log. Safe to rerun.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS provenance jsonb;

CREATE TABLE IF NOT EXISTS opportunity_audit (
  audit_id       bigserial PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  at             timestamptz NOT NULL DEFAULT now(),
  actor_role     text NOT NULL CHECK (actor_role IN ('collector', 'reviewer', 'student', 'system')),
  actor          text,            -- demo username for reviewers; never shown publicly for students
  action         text NOT NULL CHECK (action IN ('collected', 'recollected', 'status', 'reported',
                                                 'report_resolved', 'lead_added', 'access_updated', 'backfill')),
  from_status    text,
  to_status      text,
  detail         jsonb
);
CREATE INDEX IF NOT EXISTS opportunity_audit_opp ON opportunity_audit (opportunity_id, at);

-- Append-only: block UPDATE and DELETE on audit rows (rows still go when a listing is deleted, via CASCADE).
CREATE OR REPLACE FUNCTION opportunity_audit_readonly() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM opportunities WHERE opportunity_id = OLD.opportunity_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'opportunity_audit is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS opportunity_audit_no_change ON opportunity_audit;
CREATE TRIGGER opportunity_audit_no_change BEFORE UPDATE OR DELETE ON opportunity_audit
  FOR EACH ROW EXECUTE FUNCTION opportunity_audit_readonly();

-- Backfill: what we can honestly reconstruct for listings that existed before the log.
INSERT INTO opportunity_audit (opportunity_id, at, actor_role, action, to_status, detail)
SELECT o.opportunity_id, o.first_collected_at, 'system', 'backfill', o.status,
       jsonb_build_object('note', 'Collected before the audit log existed; earlier history was not recorded.')
  FROM opportunities o
 WHERE NOT EXISTS (SELECT 1 FROM opportunity_audit a WHERE a.opportunity_id = o.opportunity_id);
