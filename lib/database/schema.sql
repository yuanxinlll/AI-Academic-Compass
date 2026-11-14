-- Academic Compass — Neon PostgreSQL schema
-- 依据 docs/contracts.md。在 Neon SQL Editor 中整段运行即可。
-- 可重复运行：会先删掉旧表再重建（⚠️ 会清空数据，正式采集开始后不要再整段运行）。

DROP TABLE IF EXISTS collection_logs, saved_opportunities, opportunities, sources, student_profiles, users CASCADE;

-- ─────────────────────────────────────────────
-- 1. users：用户账户
-- ─────────────────────────────────────────────
CREATE TABLE users (
  user_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. student_profiles：学生档案（私人数据）
-- ─────────────────────────────────────────────
CREATE TABLE student_profiles (
  user_id              uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  -- 基本学术背景
  university           text NOT NULL DEFAULT 'UCSD',
  major                text,
  minor                text,
  academic_year        text CHECK (academic_year IN ('freshman','sophomore','junior','senior','graduate')),
  expected_graduation  text,                       -- 'YYYY-MM'
  courses_taken        text[] NOT NULL DEFAULT '{}',
  -- 兴趣与目标
  interests            text[] NOT NULL DEFAULT '{}',
  research_areas       text[] NOT NULL DEFAULT '{}',
  career_goals         text[] NOT NULL DEFAULT '{}',
  selected_modules     text[] NOT NULL DEFAULT '{}', -- Category[]
  -- 技能与经历
  skills               text[] NOT NULL DEFAULT '{}',
  experiences          jsonb  NOT NULL DEFAULT '[]', -- Experience[]
  -- 申请资格
  hours_per_week       integer,
  available_terms      text[] NOT NULL DEFAULT '{}',
  work_authorization   text,                       -- 仅学生主动填写
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 3. sources：信息来源
-- ─────────────────────────────────────────────
CREATE TABLE sources (
  source_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university       text NOT NULL DEFAULT 'UCSD',
  website_url      text UNIQUE NOT NULL,
  source_type      text NOT NULL DEFAULT 'other'
                   CHECK (source_type IN ('lab_page','department','calendar','listing','other')),
  last_checked_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. opportunities：学术机会（公共数据）
-- ─────────────────────────────────────────────
CREATE TABLE opportunities (
  opportunity_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  university          text NOT NULL DEFAULT 'UCSD',
  organization        text,
  category            text NOT NULL
                      CHECK (category IN ('research','internship','event','competition','program','course')),
  description         text,
  required_skills     text[] NOT NULL DEFAULT '{}',
  eligibility         jsonb  NOT NULL DEFAULT '[]',  -- EligibilityRequirement[]
  deadline            date,
  deadline_text       text,
  application_method  text,
  source_url          text UNIQUE NOT NULL,          -- 基础去重
  source_id           uuid REFERENCES sources(source_id) ON DELETE SET NULL,
  first_collected_at  timestamptz NOT NULL DEFAULT now(),
  last_verified_at    timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'needs_verification'
                      CHECK (status IN ('verified','needs_verification','expired'))
);

CREATE INDEX idx_opp_category ON opportunities(category);
CREATE INDEX idx_opp_deadline ON opportunities(deadline);
CREATE INDEX idx_opp_status   ON opportunities(status);

-- ─────────────────────────────────────────────
-- 5. saved_opportunities：收藏与申请状态（私人数据）
-- ─────────────────────────────────────────────
CREATE TABLE saved_opportunities (
  user_id             uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  opportunity_id      uuid NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  application_status  text NOT NULL DEFAULT 'saved'
                      CHECK (application_status IN ('saved','applying','applied','rejected','accepted')),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);

-- ─────────────────────────────────────────────
-- 6. collection_logs：采集日志
-- ─────────────────────────────────────────────
CREATE TABLE collection_logs (
  log_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        uuid REFERENCES sources(source_id) ON DELETE SET NULL,
  collection_time  timestamptz NOT NULL DEFAULT now(),
  records_found    integer NOT NULL DEFAULT 0,
  errors           jsonb NOT NULL DEFAULT '[]'
);

-- ═════════════════════════════════════════════
-- 开发用假数据（供前端和匹配模块先行开发）
-- 全部使用 https://example.com/seed/ 链接，真实数据上线后执行：
--   DELETE FROM opportunities WHERE source_url LIKE 'https://example.com/seed/%';
-- ═════════════════════════════════════════════
INSERT INTO opportunities
  (title, organization, category, description, required_skills, eligibility, deadline, deadline_text, application_method, source_url, status)
VALUES
  ('Undergraduate Research Assistant — Computational Biology',
   'Seed Demo Lab A', 'research',
   'Assist with genomics data analysis and pipeline maintenance.',
   ARRAY['Python','pandas'],
   '[{"type":"hours_per_week","value":10,"raw_text":"at least 10 hours per week","is_hard_requirement":true},
     {"type":"academic_year","value":["sophomore","junior","senior"],"raw_text":"open to sophomores and above","is_hard_requirement":true}]',
   '2026-12-15', NULL, 'Email CV to the lab manager',
   'https://example.com/seed/research-compbio', 'needs_verification'),

  ('ML Research Intern — NLP Group',
   'Seed Demo Lab B', 'research',
   'Work on evaluation of large language models.',
   ARRAY['Python','PyTorch'],
   '[{"type":"course","value":["CSE 151A"],"raw_text":"CSE 151A or equivalent preferred","is_hard_requirement":false}]',
   NULL, 'Rolling basis', 'Fill out the interest form',
   'https://example.com/seed/research-nlp', 'needs_verification'),

  ('Summer Data Science Internship',
   'Seed Demo Company', 'internship',
   'Build dashboards and analyze product metrics.',
   ARRAY['SQL','Python'],
   '[{"type":"work_authorization","value":null,"raw_text":"must be authorized to work in the US","is_hard_requirement":true}]',
   '2027-01-31', NULL, 'Apply via company portal',
   'https://example.com/seed/internship-ds', 'needs_verification'),

  ('AI for Science Seminar Series',
   'Seed Demo Department', 'event',
   'Weekly talks on applications of AI in the natural sciences.',
   ARRAY[]::text[], '[]',
   '2026-11-20', NULL, 'Free, RSVP online',
   'https://example.com/seed/event-seminar', 'needs_verification'),

  ('Campus Data Hackathon',
   'Seed Demo Club', 'competition',
   '24-hour hackathon on open civic datasets.',
   ARRAY[]::text[], '[]',
   '2026-12-01', NULL, 'Register as a team of up to 4',
   'https://example.com/seed/competition-hackathon', 'needs_verification'),

  ('Summer Undergraduate Research Fellowship',
   'Seed Demo Program Office', 'program',
   'Ten-week funded summer research program with a faculty mentor.',
   ARRAY[]::text[],
   '[{"type":"academic_year","value":["sophomore","junior"],"raw_text":"current sophomores and juniors","is_hard_requirement":true},
     {"type":"gpa","value":3.0,"raw_text":"minimum GPA 3.0","is_hard_requirement":true}]',
   '2027-02-15', NULL, 'Online application with faculty letter',
   'https://example.com/seed/program-surf', 'needs_verification');

-- 验证
SELECT category, count(*) FROM opportunities GROUP BY category ORDER BY category;

-- After running this file, also run lib/database/migrations/*.sql in order.
