-- 002: demo accounts, roles, AI disclaimer, interest statement.
-- Safe to run more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disclaimer_accepted_at timestamptz;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS interest_statement text;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS interest_keywords text[] NOT NULL DEFAULT '{}';

-- Demo accounts (fictional people).
INSERT INTO users (email, name, display_name, role) VALUES
  ('maya@demo.academic-compass.local',   'maya',   'Maya Chen',     'student'),
  ('jordan@demo.academic-compass.local', 'jordan', 'Jordan Rivera', 'student'),
  ('priya@demo.academic-compass.local',  'priya',  'Priya Patel',   'student'),
  ('admin@demo.academic-compass.local',  'admin',  'Reviewer',      'admin')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role;

-- Pre-filled demo profiles so judges see results immediately. Never overwrites edits.
INSERT INTO student_profiles (user_id, university, major, minor, academic_year, expected_graduation,
  courses_taken, interests, research_areas, career_goals, selected_modules, skills, experiences,
  hours_per_week, available_terms, interest_statement, interest_keywords)
SELECT u.user_id, 'UCSD', p.major, p.minor, p.academic_year, p.grad,
  p.courses, p.interests, p.areas, p.goals, p.modules, p.skills, p.experiences::jsonb,
  p.hours, p.terms, p.statement, p.keywords
FROM (VALUES
  ('maya@demo.academic-compass.local', 'Computer Science', NULL, 'sophomore', '2029-06',
   ARRAY['CSE 11','CSE 12','CSE 20','MATH 20C'], ARRAY['machine learning','human-computer interaction'],
   ARRAY['machine learning','HCI'], ARRAY['research','grad school'], ARRAY['research','internship','event','competition'],
   ARRAY['Python','Java','React'], '[{"type":"project","title":"Course-planning chatbot","organization":"Personal project","description":"Built a small retrieval chatbot over UCSD course descriptions."}]',
   10, ARRAY['winter','spring','summer'],
   'I want my first research experience in machine learning, ideally on tools people actually use.',
   ARRAY['machine learning','HCI','research','Python']),
  ('jordan@demo.academic-compass.local', 'Biology', 'Chemistry', 'junior', '2028-06',
   ARRAY['BILD 1','BILD 2','BIPN 100','CHEM 40A'], ARRAY['neuroscience','molecular biology'],
   ARRAY['neuroscience'], ARRAY['medical school','research'], ARRAY['research','program','event'],
   ARRAY['wet lab techniques','R','microscopy'], '[{"type":"research","title":"Volunteer lab assistant","organization":"Campus lab","description":"Prepared solutions and kept lab records."}]',
   12, ARRAY['spring','summer'],
   'Looking for a summer research program or lab position in neuroscience before applying to med school.',
   ARRAY['neuroscience','summer research','lab']),
  ('priya@demo.academic-compass.local', 'Cognitive Science', 'Data Science', 'junior', '2028-06',
   ARRAY['COGS 9','COGS 14A','DSC 10','DSC 20'], ARRAY['data for social good','public policy'],
   ARRAY['data science','public health'], ARRAY['nonprofit','data analyst'], ARRAY['research','internship','competition','program'],
   ARRAY['Python','SQL','Tableau'], '[{"type":"other","title":"Transferred from community college","organization":"San Diego community college","description":"Led a peer tutoring group for statistics."}]',
   8, ARRAY['winter','spring'],
   'Transfer student who wants to use data skills for community and public-interest projects.',
   ARRAY['data for good','public health','Python','SQL'])
) AS p(email, major, minor, academic_year, grad, courses, interests, areas, goals, modules, skills,
       experiences, hours, terms, statement, keywords)
JOIN users u ON u.email = p.email
ON CONFLICT (user_id) DO NOTHING;
