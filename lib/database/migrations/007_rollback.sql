DROP TABLE IF EXISTS opportunity_audit;
DROP FUNCTION IF EXISTS opportunity_audit_readonly();
ALTER TABLE opportunities DROP COLUMN IF EXISTS provenance;
