-- 001: keep human-verified status when the COLLECTOR re-saves unchanged content.
-- Why: A's collector upserts status='needs_verification' on every run, which would
-- wipe out manual verification. Only applies to the `collector` role, so D's own
-- API (neondb_owner) can still un-verify on purpose. Safe to re-run.

CREATE OR REPLACE FUNCTION preserve_verified_status() RETURNS trigger AS $$
BEGIN
  IF current_user = 'collector'
     AND OLD.status = 'verified' AND NEW.status = 'needs_verification'
     AND (OLD.title, OLD.organization, OLD.category, OLD.description, OLD.required_skills,
          OLD.eligibility, OLD.deadline, OLD.deadline_text, OLD.application_method)
         IS NOT DISTINCT FROM
         (NEW.title, NEW.organization, NEW.category, NEW.description, NEW.required_skills,
          NEW.eligibility, NEW.deadline, NEW.deadline_text, NEW.application_method)
  THEN
    NEW.status := 'verified';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_preserve_verified ON opportunities;
CREATE TRIGGER trg_preserve_verified
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION preserve_verified_status();

SELECT tgname FROM pg_trigger WHERE tgname = 'trg_preserve_verified';
