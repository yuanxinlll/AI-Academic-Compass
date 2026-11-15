// Property tests for relevance v2. Run: node --experimental-strip-types tests/relevance.test.mts
// Each property should hold for any profile/listing, so we check it across many generated cases.
import { scoreAll } from "../lib/relevance.ts";

const TOPICS = ["machine learning", "neuroscience", "public health", "ecology", "human-computer interaction", "policy", "chemistry", "data science"];
const SKILLS = ["Python", "R", "SQL", "Java", "microscopy", "React", "MATLAB", "wet lab techniques"];
const MAJORS = ["Computer Science", "Biology", "Cognitive Science", "Data Science", "Political Science", "Chemistry"];
const CATS = ["research", "internship", "event", "competition", "program", "course"];

let seed = 42;
const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
const pick = <T,>(xs: readonly T[], k: number) => [...xs].sort(() => rnd() - 0.5).slice(0, k);

function opp(id: string, title: string, description: string, extra: Record<string, unknown> = {}) {
  return { opportunity_id: id, title, description, organization: null, category: "research", required_skills: [], eligibility: [], ...extra };
}
function score(profile: Record<string, unknown>, o: ReturnType<typeof opp>, others: ReturnType<typeof opp>[] = []) {
  return scoreAll(profile, [o, ...others], new Map()).get(o.opportunity_id)!.relevance_score ?? -1;
}

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fails.push(`${name} ${detail}`);
}

for (let i = 0; i < 200; i++) {
  const interests = pick(TOPICS, 3);
  const skills = pick(SKILLS, 3);
  const profile = { major: pick(MAJORS, 1)[0], interests, skills, selected_modules: pick(CATS, 3), hours_per_week: 10, available_terms: ["winter", "spring"] };
  const filler = [opp("f1", "Campus tour guide", "Lead tours."), opp("f2", "Library assistant", "Shelve books.")];

  // P1: mentioning one more of the student's interests never lowers the score.
  const a = opp("a", "Undergraduate research", `Project on ${interests[0]}.`);
  const b = opp("a", "Undergraduate research", `Project on ${interests[0]} and ${interests[1]}.`);
  check("P1 more interests >= fewer", score(profile, b, filler) >= score(profile, a, filler), `${interests}`);

  // P2: having one more of the listed skills never lowers the score.
  const req = pick(SKILLS, 3);
  const withSkills = { ...profile, skills: req.slice(0, 1) };
  const moreSkills = { ...profile, skills: req.slice(0, 2) };
  const o = opp("s", "Lab assistant", "Assist the lab.", { required_skills: req });
  check("P2 more skills >= fewer", score(moreSkills, o, filler) >= score(withSkills, o, filler), `${req}`);

  // P3: interest in the title counts at least as much as the same interest only in the body.
  const t = opp("t", `${interests[0]} lab assistant`, "Help the team.");
  const d = opp("t", "Lab assistant", `Help the team with ${interests[0]}.`);
  check("P3 title >= body", score(profile, t, filler) >= score(profile, d, filler), interests[0]);

  // P4: missing data is skipped, not scored as zero (a listing with no skills listed is not penalized).
  const noSkills = opp("n", `${interests[0]} project`, "Details soon.");
  const unmatchedSkills = opp("n", `${interests[0]} project`, "Details soon.", { required_skills: ["Fortran", "COBOL"] });
  check("P4 unknown >= known mismatch", score(profile, noSkills, filler) >= score(profile, unmatchedSkills, filler));

  // P5: score is within 0..100.
  const s = score(profile, b, filler);
  check("P5 range", s >= 0 && s <= 100, String(s));
}

console.log(`relevance properties: ${pass} of ${pass + fails.length} checks passed`);
if (fails.length) {
  console.log([...new Set(fails)].slice(0, 10).join("\n"));
  process.exit(1);
}
