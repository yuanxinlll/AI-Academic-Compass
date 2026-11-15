-- Undo 002_demo_accounts.sql (returns the database to its pre-takeover shape).
DELETE FROM users WHERE email IN (
  'maya@demo.academic-compass.local', 'jordan@demo.academic-compass.local',
  'priya@demo.academic-compass.local', 'admin@demo.academic-compass.local');
ALTER TABLE student_profiles DROP COLUMN IF EXISTS interest_keywords;
ALTER TABLE student_profiles DROP COLUMN IF EXISTS interest_statement;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP COLUMN IF EXISTS disclaimer_accepted_at;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
ALTER TABLE users DROP COLUMN IF EXISTS role;
