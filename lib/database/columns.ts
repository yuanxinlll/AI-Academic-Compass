// Column lists shared by routes so every endpoint returns the exact contract shape.
// `deadline` is cast to text so it stays "YYYY-MM-DD" (no timezone shift).

export const OPPORTUNITY_COLUMNS = `
  o.opportunity_id, o.title, o.university, o.organization, o.category, o.description,
  o.required_skills, o.eligibility, o.deadline::text AS deadline, o.deadline_text,
  o.application_method, o.source_url, o.source_id, o.first_collected_at,
  o.last_verified_at, o.status, o.access, o.source_kind`;

export const PROFILE_COLUMNS = `
  user_id, university, major, minor, academic_year, expected_graduation, courses_taken,
  interests, research_areas, career_goals, selected_modules, skills, experiences,
  hours_per_week, available_terms, work_authorization, updated_at`;
