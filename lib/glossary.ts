// Campus words: the "hidden curriculum" a first-generation, transfer or international student
// may never have been told. Fixed, hand-written definitions (not AI). Each entry says when a word
// matters for applying. Shown inline on listings (first use only) and in full at /glossary.

export type Term = {
  term: string;
  /** Matches the word in listing text. Keep word boundaries tight to avoid false hits. */
  match: RegExp;
  text: string;
  group: "People" | "Courses & credit" | "Applying" | "Money" | "Status & eligibility" | "Places & tools";
};

export const GLOSSARY: Term[] = [
  // People
  { group: "People", term: "PI", match: /\bPIs?\b|\bprincipal investigators?\b/i, text: "Principal investigator: the faculty member who runs the lab and decides who joins. Your first email usually goes to them or to the lab manager." },
  { group: "People", term: "Faculty mentor", match: /\bfaculty (?:mentor|advisor|adviser)s?\b|\bmentors?\b/i, text: "The professor who supervises your research and signs off on credit. Many programs make you find one before you apply." },
  { group: "People", term: "Postdoc", match: /\bpost-?docs?\b|\bpostdoctoral\b/i, text: "A researcher who already has a PhD. Postdocs and grad students often train undergraduates day to day — they are good people to ask about joining." },
  { group: "People", term: "Grad student", match: /\bgrad(?:uate)? students?\b|\bPh\.?D\.? students?\b/i, text: "Students working on a master's or PhD. In many labs they are your direct supervisor, not the professor." },
  { group: "People", term: "Lab manager", match: /\blab (?:manager|coordinator)s?\b|\bresearch coordinators?\b/i, text: "Staff who run the lab's day-to-day work, schedules and onboarding. Often the right first contact." },
  { group: "People", term: "RA", match: /\bRAs?\b|\bresearch assistants?\b|\bUGAs?\b/, text: "Research assistant: an undergraduate helping with a lab's studies. It can be volunteer, for credit, or paid — the listing should say which." },
  { group: "People", term: "TA", match: /\bTAs?\b|\bteaching assistants?\b/, text: "Teaching assistant, usually a grad student. TAs hold office hours and can point you to research openings in their lab." },
  { group: "People", term: "Postbacc", match: /\bpost-?bacc(?:alaureate)?s?\b/i, text: "Someone who has finished a bachelor's degree and is getting research experience before graduate school." },

  // Courses & credit
  { group: "Courses & credit", term: "99 / 199", match: /\b(?:[A-Z]{2,5}[\s-]?)?(?:99H?|199)\b/, text: "Independent study courses where you earn units for research with a faculty member. 99 is for lower-division students, 199 for upper-division. You usually need the professor's approval first." },
  { group: "Courses & credit", term: "198", match: /\b(?:[A-Z]{2,5}[\s-]?)?198\b/, text: "Directed group study: a small, faculty-led course, often used for team research projects." },
  { group: "Courses & credit", term: "Independent study", match: /\bindependent (?:study|research)\b|\bspecial studies\b/i, text: "Course credit for work you do outside a classroom — like research — under a faculty member. It has its own approval form." },
  { group: "Courses & credit", term: "Units", match: /\bunits?\b/i, text: "Course credit. A full-time load is about 12 or more units a quarter. For research courses, expect about 30 hours of work per unit over the quarter." },
  { group: "Courses & credit", term: "Upper / lower division", match: /\b(?:upper|lower)[- ]division\b|\bUD courses?\b/i, text: "Lower-division courses are numbered 1–99, upper-division 100–199. \"Upper-division standing\" usually means about 90 completed units." },
  { group: "Courses & credit", term: "Quarter", match: /\bquarters?\b/i, text: "UC San Diego's 10-week terms: Fall, Winter and Spring, plus Summer Sessions. \"Two quarters minimum\" means about six months." },
  { group: "Courses & credit", term: "Week 1", match: /\bweek (?:1|one|0|zero)\b/i, text: "The first week of the quarter. Many add deadlines fall at the end of Week 1 or 2, so research credit has to be approved fast." },
  { group: "Courses & credit", term: "P/NP", match: /\bP\/NP\b|\bpass\/no pass\b/i, text: "Pass/No Pass grading. Research courses are often P/NP, so they do not change your GPA." },
  { group: "Courses & credit", term: "Prerequisite", match: /\bprerequisites?\b|\bprereqs?\b/i, text: "A course or condition you must finish first. Listings sometimes accept \"or equivalent\" — ask if yours is close." },
  { group: "Courses & credit", term: "Honors program / thesis", match: /\bhonors (?:program|thesis)\b|\bsenior thesis\b/i, text: "A year-long research project in your major that ends in a written thesis. Departments set their own GPA and course rules." },
  { group: "Courses & credit", term: "Cohort", match: /\bcohorts?\b/i, text: "A group of students who start a program together and move through it as a group, usually with fixed meetings." },

  // Applying
  { group: "Applying", term: "CV", match: /\bCVs?\b|\bcurriculum vitae\b/i, text: "An academic résumé: education, research, skills, awards. For undergrads, a one-page résumé is usually fine." },
  { group: "Applying", term: "Cover letter", match: /\bcover letters?\b/i, text: "A short letter — half a page is plenty — saying why this lab interests you and what you can bring." },
  { group: "Applying", term: "Statement of interest", match: /\bstatement of (?:interest|purpose)\b|\bpersonal statement\b|\bshort[- ]answer\b/i, text: "A short essay about why you want this and what you would do. Specific beats impressive: name a project or question." },
  { group: "Applying", term: "References", match: /\breferences?\b|\brecommendation letters?\b|\bletters? of recommendation\b/i, text: "People who can vouch for you — often a professor, TA or supervisor. Ask them at least two weeks ahead and send your résumé." },
  { group: "Applying", term: "Transcript", match: /\btranscripts?\b/i, text: "Your list of courses and grades. An unofficial transcript from the student portal is usually enough unless the listing says official." },
  { group: "Applying", term: "Rolling", match: /\brolling\b/i, text: "Applications are reviewed as they arrive, so applying early helps even without a fixed deadline." },
  { group: "Applying", term: "Interest form", match: /\binterest form\b|\bexpress interest\b/i, text: "A short form that puts you on a list. It is not an application yet — the lab contacts you when a spot opens." },
  { group: "Applying", term: "Office hours", match: /\boffice hours\b/i, text: "Set times when a professor or TA is available to talk. You do not need a question about class — asking about their research is normal." },
  { group: "Applying", term: "Lab meeting", match: /\blab meetings?\b|\bjournal clubs?\b/i, text: "A regular meeting where the lab discusses its work or a paper. Members are usually expected to attend." },
  { group: "Applying", term: "Symposium / poster", match: /\bsymposi(?:um|a)\b|\bposters?\b|\bconference\b/i, text: "An event where students present their research, often as a poster. Many programs require one at the end." },
  { group: "Applying", term: "IRB / CITI training", match: /\bIRB\b|\bCITI\b|\bhuman subjects\b/i, text: "Required training before working with study participants. Labs usually tell you which online modules to complete." },

  // Money
  { group: "Money", term: "Stipend", match: /\bstipends?\b/i, text: "A fixed payment for taking part, rather than an hourly wage. It may count as taxable income and can affect financial aid." },
  { group: "Money", term: "Fellowship", match: /\bfellowships?\b/i, text: "Money awarded to support you while you do research or study. Some are paid as a stipend, some go toward tuition." },
  { group: "Money", term: "Volunteer", match: /\bvolunteers?\b|\bunpaid\b/i, text: "No pay and no credit. Some labs start everyone as volunteers. If you need income, ask whether credit or paid roles exist." },
  { group: "Money", term: "Pell Grant", match: /\bPell\b/i, text: "A federal grant for students with financial need. \"Pell-eligible\" is often used to mean low-income." },
  { group: "Money", term: "Unmet need", match: /\bunmet need\b|\bcost of attendance\b/i, text: "The gap between what college costs you and the aid you already get. Some scholarships pay only toward this gap." },
  { group: "Money", term: "Work-study", match: /\bwork-?study\b/i, text: "A federal aid program that pays part of your wages for an approved job. It must be in your aid offer to use it." },

  // Status & eligibility
  { group: "Status & eligibility", term: "Standing", match: /\b(?:sophomore|junior|senior|class|upper-division|lower-division) standing\b/i, text: "Your class level, counted by completed units rather than years in school. Transfer students often have junior standing on day one." },
  { group: "Status & eligibility", term: "GPA", match: /\bGPA\b|\bgrade point average\b/i, text: "Grade point average on a 4.0 scale. Programs usually mean your UC San Diego GPA; incoming transfer students may be asked for their previous school's." },
  { group: "Status & eligibility", term: "Declared major", match: /\bdeclared (?:\w+ )?major\b/i, text: "A major you have officially chosen in the system — not just one you plan to choose." },
  { group: "Status & eligibility", term: "Work authorization", match: /\bwork authori[sz]ation\b|\bcitizens?(?:hip)?\b|\bpermanent residents?\b/i, text: "Being legally allowed to work in the U.S. International students on F-1 or J-1 visas have limits on paid work — ask International Students & Programs (ISPO) before accepting a paid role." },
  { group: "Status & eligibility", term: "F-1 / CPT", match: /\bF-?1\b|\bJ-?1\b|\bCPT\b|\bOPT\b|\bvisas?\b/, text: "F-1 and J-1 are student visas. Paid work is limited; off-campus internships usually need CPT approval first. ISPO can tell you what applies to you." },
  { group: "Status & eligibility", term: "Undocumented", match: /\bundocumented\b|\bAB ?540\b|\bDACA\b/i, text: "UC San Diego's Undocumented Student Services can tell you which programs and payments you qualify for." },
  { group: "Status & eligibility", term: "First-generation", match: /\bfirst[- ]gen(?:eration)?\b/i, text: "Usually means neither parent finished a four-year degree. Programs define it a little differently — check their wording." },
  { group: "Status & eligibility", term: "REU", match: /\bREUs?\b|\bResearch Experiences? for Undergraduates\b/i, text: "Paid summer research programs funded by the U.S. National Science Foundation. NSF-funded spots are often limited to U.S. citizens and permanent residents — check the listing." },

  // Places & tools
  { group: "Places & tools", term: "TEA", match: /\bTEA\b|\bTriton Enrollment Authorization\b/, text: "Triton Enrollment Authorization: the online request in the Triton Student System you submit to get approved for courses like 99/199." },
  { group: "Places & tools", term: "Handshake", match: /\bHandshake\b/i, text: "UC San Diego's job and internship site, run by Career Services. Sign in with your student account." },
  { group: "Places & tools", term: "REAL portal", match: /\bREAL\b/, text: "UC San Diego's portal for research and experiential-learning postings (real.ucsd.edu)." },
  { group: "Places & tools", term: "SONA", match: /\bSONA\b/, text: "The system psychology labs use to sign up study participants — taking part is not the same as working in the lab." },
  { group: "Places & tools", term: "URH", match: /\bURH\b|\bUndergraduate Research Hub\b/i, text: "The Undergraduate Research Hub: runs research programs and helps you find a faculty mentor." },
];

export type Hit = { start: number; end: number; term: Term };

/** First occurrence of each glossary term in a text, non-overlapping, in order. */
export function findTerms(text: string, seen: Set<string> = new Set()): Hit[] {
  const hits: Hit[] = [];
  for (const term of GLOSSARY) {
    if (seen.has(term.term)) continue;
    const re = new RegExp(term.match.source, term.match.flags.replace("g", ""));
    const m = re.exec(text);
    if (!m || !m[0].trim()) continue;
    const start = m.index + (m[0].length - m[0].trimStart().length);
    const end = m.index + m[0].trimEnd().length;
    if (hits.some((h) => start < h.end && end > h.start)) continue;
    hits.push({ start, end, term });
  }
  for (const h of hits) seen.add(h.term.term);
  return hits.sort((a, b) => a.start - b.start);
}

export function termsIn(text: string): Term[] {
  return GLOSSARY.filter((t) => t.match.test(text));
}

/**
 * Decides, in reading order, which text explains which word, so each word is explained once.
 * Pure (no shared mutable state during render). Returns text → words to mark in it.
 */
export function assignTerms(texts: (string | null | undefined)[]): Map<string, Set<string>> {
  const seen = new Set<string>();
  const out = new Map<string, Set<string>>();
  for (const t of texts) {
    if (!t) continue;
    const mine = out.get(t) ?? new Set<string>();
    for (const h of findTerms(t, seen)) mine.add(h.term.term);
    out.set(t, mine);
  }
  return out;
}
