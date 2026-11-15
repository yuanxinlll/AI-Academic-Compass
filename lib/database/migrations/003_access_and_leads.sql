-- 003: access facts (who can apply), multimodal provenance, student background, AI-found leads.
-- Safe to run more than once. Undo: 003_rollback.sql
--
-- opportunities.access = {
--   "international": {"value": "open"|"restricted"|"unstated", "quote": "..."|null},
--   "first_gen":     {"value": "focus"|"unstated", "quote": ...},
--   "transfer":      {"value": "focus"|"unstated", "quote": ...},
--   "compensation":  {"value": "paid"|"stipend"|"credit"|"unpaid"|"unstated", "quote": ...},
--   "cost":          {"value": "free"|"fee"|"unstated", "quote": ...}
-- }  Every non-"unstated" value must carry an exact quote from the source.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS access jsonb NOT NULL DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'webpage';
DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT opportunities_source_kind_check
    CHECK (source_kind IN ('webpage', 'flyer_image', 'instagram'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Self-reported, optional. Never inferred from name, school or resume.
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS first_generation boolean;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS transfer_student boolean;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS international_student boolean;

-- Facts an AI web search found OUTSIDE the listing's own page. Shown as unverified leads
-- with their evidence URL; never used for eligibility.
CREATE TABLE IF NOT EXISTS opportunity_leads (
  lead_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  field          text NOT NULL,           -- e.g. deadline, eligibility, application_method
  value          text NOT NULL,
  quote          text NOT NULL,           -- exact text on evidence_url
  evidence_url   text NOT NULL,
  found_by       text NOT NULL DEFAULT 'gemini_search',
  status         text NOT NULL DEFAULT 'unreviewed' CHECK (status IN ('unreviewed', 'confirmed', 'rejected')),
  found_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, field, evidence_url, quote)
);

-- Demo personas (fictional): Maya typical · Jordan first-gen · Priya CC transfer · Wei international.
INSERT INTO users (email, name, display_name, role) VALUES
  ('wei@demo.academic-compass.local', 'wei', 'Wei Zhang', 'student')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

UPDATE student_profiles p SET first_generation = false, transfer_student = false, international_student = false
  FROM users u WHERE u.user_id = p.user_id AND u.email = 'maya@demo.academic-compass.local' AND p.first_generation IS NULL;
UPDATE student_profiles p SET first_generation = true, transfer_student = false, international_student = false
  FROM users u WHERE u.user_id = p.user_id AND u.email = 'jordan@demo.academic-compass.local' AND p.first_generation IS NULL;
UPDATE student_profiles p SET first_generation = true, transfer_student = true, international_student = false
  FROM users u WHERE u.user_id = p.user_id AND u.email = 'priya@demo.academic-compass.local' AND p.first_generation IS NULL;

INSERT INTO student_profiles (user_id, university, major, minor, academic_year, expected_graduation,
  courses_taken, interests, research_areas, career_goals, selected_modules, skills, experiences,
  hours_per_week, available_terms, work_authorization, interest_statement, interest_keywords,
  first_generation, transfer_student, international_student)
SELECT u.user_id, 'UCSD', 'Data Science', NULL, 'junior', '2028-06',
  ARRAY['DSC 10','DSC 20','DSC 40A','MATH 18'], ARRAY['machine learning','public health','data visualization'],
  ARRAY['machine learning'], ARRAY['research','industry'], ARRAY['research','internship','event','competition','program'],
  ARRAY['Python','SQL','pandas','Tableau'],
  '[{"type":"project","title":"Air quality dashboard","organization":"Class project","description":"Visualized county air quality data."}]'::jsonb,
  15, ARRAY['winter','spring','summer'], 'F-1 student visa',
  'International student looking for research or paid campus roles I am actually allowed to take.',
  ARRAY['machine learning','public health','data visualization','Python'],
  false, false, true
FROM users u WHERE u.email = 'wei@demo.academic-compass.local'
ON CONFLICT (user_id) DO NOTHING;
