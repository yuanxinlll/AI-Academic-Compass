DELETE FROM users WHERE email = 'wei@demo.academic-compass.local';
DROP TABLE IF EXISTS opportunity_leads;
ALTER TABLE student_profiles DROP COLUMN IF EXISTS international_student;
ALTER TABLE student_profiles DROP COLUMN IF EXISTS transfer_student;
ALTER TABLE student_profiles DROP COLUMN IF EXISTS first_generation;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_source_kind_check;
ALTER TABLE opportunities DROP COLUMN IF EXISTS source_kind;
ALTER TABLE opportunities DROP COLUMN IF EXISTS access;
