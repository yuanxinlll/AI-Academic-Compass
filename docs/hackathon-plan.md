# Academic Compass — SanD Hacks 2026 project plan

Academic Compass is a four-person project that uses AI to discover academic opportunities, assess eligibility, and give students a personalized dashboard. Start with UC San Diego and leave room to expand to other universities. Potential tracks include Best Overall Hack, Data for Good, and AI, agent, and sponsor challenges.

**Project motto** — Discover Opportunities. Navigate Your Future.

Reconciled 2026-11-14 with the complete Chinese governing plan supplied by the
user. This English document preserves its product requirements and priorities;
it is not a claim that those features are already implemented. See
[governance alignment](governance-alignment.md) for differences and unresolved
contract conflicts. Engineering rules live in the repository's AGENTS.md;
endpoint details remain in [the shared contract](contracts.md).

See [engineering instructions](../AGENTS.md) for module boundaries, the shared opportunity contract, and development rules.

## 1. Problem and approach

Undergraduates find research roles, internships, events, and competitions across professor pages, lab sites, departments, and other platforms. Some pages omit posting dates and deadlines, so students struggle to tell whether an opportunity is active. Requirements for majors, class years, skills, and work authorization vary by listing. Screening takes time, and students at different schools or with different backgrounds may have unequal access to the information.

Academic Compass has three goals.

1. **Automate collection.** Discover, extract, organize, and update opportunities from multiple public sources with minimal manual entry.
2. **Assess eligibility and rank opportunities.** Use students’ résumés, majors, class years, skills, and interests to bring relevant listings to the top while keeping the full collection accessible.
3. **Improve access to information.** Centralize public listings and eventually compare how universities publish them.

Automated collection is the core feature. Personalization supports it, and Data for Good analysis is an extension.

## 2. Audience and opportunity categories

Start with UC San Diego undergraduates. Future coverage may include UCLA, UC Irvine, other UC campuses, and other U.S. universities. Students choose the categories they want to follow during onboarding. Those choices determine which modules appear on their dashboard.

| Category | Examples |
| --- | --- |
| Research and research assistantships | Lab openings, faculty research projects, undergraduate RA positions |
| Internships | Company internships, research institute internships, campus jobs |
| Academic events | Workshops, seminars, conferences, academic talks |
| Competitions | Hackathons, data science competitions, research challenges |
| Academic programs | Summer research, fellowships, exchange programs |
| Courses and learning | Courses, training programs, learning resources |

The audience is UCSD undergraduates, not only research applicants. Company and
research-institute internships and campus jobs are expressly in scope. A source's
host is evidence of its publisher, not proof of student eligibility; assess
relevance from the actual posting and preserve unknown requirements. This plan
does not impose a UCSD-domain-only restriction or equal category quotas. It also
does not authorize indiscriminate collection of unrelated global job listings.

## 3. Core product features

### Onboarding and résumés

Collect the student’s university, major and minor, class year, expected graduation, completed courses, and academic background. Ask about fields of interest, research and career goals, preferred opportunity categories and events, programming languages, technical skills, and research, internship, project, or other experience. For eligibility, ask about class year, prerequisites, weekly availability, project dates, and relevant work authorization or other qualifications.

Ask students to supply and confirm work authorization and similar sensitive information only when needed. Leave sensitive identity details uninferred from names, schools, or résumés.

Offer optional PDF résumé upload. Gemini extracts education, skills, research, work, projects, and research interests. Let students review, edit, and confirm the result before adding it to their profile. Students can use the questionnaire alone. Use a fictional profile and a synthetic résumé in the demo.

### Automated collection

1. Discover sites that may list academic opportunities.
2. Fetch public pages.
3. Check whether a page contains a valid opportunity.
4. Extract structured data.
5. Check for duplicates.
6. Check deadlines and listing updates.
7. Save records to the database.
8. Recheck sources periodically.

The product calls for the title, institution, category, description, eligibility, required skills, deadline, application method, original URL, first collection time, latest verification time, and current verification status. Keep unsupported values unknown. Coordinate any fields beyond the [shared contract](contracts.md) with the team before adding them.

Use both **source monitoring**, which revisits known sources such as UCSD research pages, lab sites, and campus calendars, and **source discovery**, which finds new listings through search, internal links, and related sources. Bright Data supports page retrieval. Discovery still needs its own process.

### Eligibility

| Status | Meaning |
| --- | --- |
| Eligible | Available evidence supports that the student meets the stated requirements. |
| Ineligible | The student fails an explicit hard requirement. |
| Needs further confirmation | Information is insufficient for a reliable decision. |

The Chinese coding example calls the pending student value
`needs_verification`; the current API contract uses `needs_confirmation` under
`eligibility.status`. Preserve the existing API until the team confirms a
resolution; neither label should be confused with opportunity verification.

For example, check Python proficiency and a ten-hour weekly commitment separately when a posting requires both. If a listing omits work-authorization criteria, leave that criterion unresolved. Assess eligibility separately from interest matching.

### Ranking and dashboard

Rank by interests, research goals, skills, projects, category preferences, and deadlines. Let students sort by deadline, most recently posted, or personal relevance, and view all opportunities. Explain the score as a measure of relevance.

The dashboard shows a personalized feed and category modules. Students can search and filter, sort by deadline, bookmark listings, track application status, open original sources, update profiles, and customize modules. Calendar sync, deadline reminders, academic planning, application assistance, course scheduling, and daily task management are later additions.

## 4. Data for Good extension

Ask whether universities differ in how clearly and accessibly they publish opportunities. Start with UCSD and add a subset of public UCLA sources if the core platform is working. Keep hackathon coverage focused on those campuses.

| Metric | What to measure in the collected pages |
| --- | --- |
| Deadline transparency | Listings with explicit deadlines |
| Eligibility transparency | Listings with clear application requirements |
| Update visibility | Listings with a verifiable recent update |
| Application transparency | Listings with clear application instructions |
| First-year access | Listings that explicitly accept first-year students |

Report findings for the pages sampled. For example, collecting 50 UCSD listings and 20 UCLA listings could reflect differences in publication practices. Assess transparency within each sample and describe how sources were selected. Use the findings to identify barriers and inform better publication practices.

## 5. Architecture and sponsor tools

| Technology | Role | Priority |
| --- | --- | --- |
| Bright Data | Fetch public pages | Core |
| Google Gemini | Extract information and parse résumés | Core |
| Neon PostgreSQL | Store application data | Core |
| Next.js | Build the website and API | Core |
| Tailwind CSS | Style the interface | Core |
| Python / FastAPI | Data processing and optional standalone AI service | Recommended |
| Vercel | Deploy the website | Core |
| Mastra | Agent workflows | Optional |
| Figma | UI and UX design | Optional |
| GitHub | Team collaboration | Core |

### Bright Data

Prioritize Bright Data among sponsor tools. Retrieve allowed public pages from labs, faculty sites, and campus event announcements. Use the results to monitor changes and pass content to Gemini.

A typical run discovers a UCSD lab recruitment page, retrieves it with Bright Data, uses Gemini to identify an actual opening and extract requirements, the deadline, and a summary, then writes the result to Neon. The potential Bright Data or Data for Good submission can explain how public data improves student access.

### Gemini

Use Gemini to extract opportunity information, parse student résumés, and explain why an opportunity is relevant or which requirements still need confirmation. This is an illustrative partial extraction result.

```json
{
  "title": "Undergraduate Research Assistant",
  "university": "UCSD",
  "category": "research",
  "deadline": null,
  "required_skills": ["Python"],
  "eligibility": [],
  "status": "needs_verification"
}
```

Request structured JSON, validate field types, and preserve unknown values. Require source evidence for deadlines. Prefer explicit rules for hard eligibility checks. A Gemini-related MLH or sponsor challenge is a potential fit.

### Neon

Keep public opportunity records and private student data separate. Require authentication and access controls for student data so users can access their own résumés and profiles. The following tables are proposed.

| Table | Example fields |
| --- | --- |
| `users` | `user_id`, account information, `created_at` |
| `student_profiles` | `user_id`, `university`, `major`, `academic_year`, `interests`, `skills`, `selected_modules` |
| `opportunities` | `opportunity_id`, `title`, `university`, `category`, `description`, `eligibility`, `deadline`, `source_url`, `last_verified_at` |
| `sources` | `source_id`, `university`, `website_url`, `source_type`, `last_checked_at` |
| `saved_opportunities` | `user_id`, `opportunity_id`, `application_status` |
| `collection_logs` | `source_id`, `collection_time`, `records_found`, `errors` |

Neon may fit a database or agent backend challenge.

### Optional tools

A Mastra agent could discover and fetch pages, extract and validate information, deduplicate listings, save records, and report updates. Python or TypeScript functions can implement that flow first. Consider Mastra and its sponsor challenge after the core flow is stable.

Use Figma as a design and collaboration tool for onboarding, résumé upload, dashboard, opportunity cards, settings, and cross-campus comparison.

| Tool | Potential use | Recommendation |
| --- | --- | --- |
| ElevenLabs | Voice search for opportunities | Defer |
| Tiger Data | Analyze trends in opportunity updates | Consider later |
| Vultr | Cloud deployment | Optional |
| GoDaddy Registry | Custom `.us` domain, registered through Porkbun | Implemented: [aiacademiccompass.us](https://aiacademiccompass.us); [domain notes](custom-domain.md) |
| Solana | Blockchain functionality | Skip for this project |
| Cursor | AI-assisted development | Recommended |

The preferred combination is Bright Data, Gemini, Neon, and Next.js.

## 6. Team responsibilities

| Member | Role | Responsibilities | Deliverable and success criterion |
| --- | --- | --- | --- |
| A | Data Collection and Discovery Engineer | Find reliable UCSD sources, integrate Bright Data, fetch and monitor pages, extract information with Gemini, handle duplicate, expired, and invalid records, and work with D to save results. Uses Bright Data, Python, Gemini, and PostgreSQL. | A collector that takes a real source and automatically fetches, extracts, validates, and saves structured opportunity records through the database integration. |
| B | AI and Personalization Engineer | Parse PDF résumés with Gemini, combine the results with questionnaire answers, implement eligibility rules and skills and interest ranking, generate explanations, and test model output accuracy. Uses Gemini, Python, pandas, and NLP. | Given a student profile and opportunities, return eligibility, rankings, and explanations. Different profiles get different rankings, with evidence for eligibility decisions. |
| C | Frontend and UX Engineer | Build the landing page, onboarding, résumé upload, dashboard, search and filters, sort controls, bookmarks, and application tracking. Support desktop and mobile layouts. Uses Next.js, React, TypeScript, Tailwind CSS, and Figma. | An interactive site where students can finish onboarding and view, filter, and manage opportunities. |
| D | Backend and Integration Engineer | Design Neon tables, configure database access, build APIs, connect the collector and personalization modules to the app, implement authentication and access controls, deploy, test integrations, and coordinate troubleshooting. Uses Next.js APIs, FastAPI where needed, Neon, PostgreSQL, Vercel, and GitHub. | A working deployment where real opportunities flow from public pages to the database to a filtered student dashboard. |

## 7. Collaboration and integration

At kickoff, agree on the MVP, database structure, API contracts, opportunity fields, student profile fields, GitHub workflow, handoff deadlines, and integration test time.

### Proposed layout

```text
academic-compass/
├── AGENTS.md
├── README.md
├── app/
│   ├── onboarding/
│   ├── dashboard/
│   ├── profile/
│   └── api/
├── components/
├── lib/
│   └── database/
├── database/
├── collector/
│   ├── discovery/
│   ├── extraction/
│   └── validation/
├── services/
│   ├── ai/
│   └── matching/
├── tests/
└── docs/
    └── hackathon-plan.md
```

The source’s sample tree places matching in `lib/matching/`. The tree above follows the engineering ownership section, which places it in `services/matching/`. Confirm the path against the repository before creating directories.

The [engineering instructions](../AGENTS.md#api-conventions) list the initial routes. The plan also proposes `POST /api/collect` for administrators or internal jobs only. The frontend can start with mock API data while the collector is being built.
The current agreed ingestion path is A's Python collector to D's authenticated
`POST /api/admin/opportunities`, then Neon. The proposed `/api/collect` remains
an optional trigger, not a reason to remove the existing ingestion endpoint.
Field names, types, enums and new fields require team confirmation before changes.

| Member | Feature branch |
| --- | --- |
| A | `feature/collection` |
| B | `feature/personalization` |
| C | `feature/frontend` |
| D | `feature/backend` |

Merge through pull requests and coordinate shared-file edits.

## 8. Hackathon schedule

This is the team’s proposed 25–26-hour schedule. Use the organizer’s schedule for official times.

| Hours | Work |
| --- | --- |
| 0–2 | Agree on the MVP, database, APIs, and GitHub setup. |
| 2–8 | Build the four core modules. |
| 8–12 | Integrate the modules and show real data on the site. |
| 12–17 | Integrate résumé parsing, eligibility, and ranking. |
| 17–21 | Test, fix issues, and refine the experience. |
| 21–23 | Add UCLA coverage or Data for Good analysis if time allows. |
| 23–26 | Deploy, record the demo, and prepare the submission. |

Milestones, in order

1. Collect and save one real opportunity.
2. Display a real opportunity on the site.
3. Complete onboarding.
4. Assess eligibility and rank opportunities.
5. Deliver a stable end-to-end demo.
6. Extend coverage to another university if time allows.

Finish the first four milestones before prioritizing Data for Good visualizations.

## 9. MVP priorities

| Priority | Features |
| --- | --- |
| Required | Accessible website, onboarding, résumé upload and extraction, automated collection of real UCSD opportunities, structured database, basic deduplication, eligibility checks, personalized ranking, search and filters, original source links, and a complete end-to-end demo |
| Aim to finish | Bookmarks, application tracking, automatic updates, recommendation explanations, data quality metrics, and stronger verification |
| If time allows | UCLA coverage, cross-campus transparency comparison, Mastra agent, calendar sync, automatic reminders, and voice interaction |

The MVP includes implementing résumé upload. Students can choose whether to use it.

## 10. Evaluation

| Area | How to evaluate |
| --- | --- |
| Information extraction | Hand-verify roughly 20–30 real listings. Compare extracted fields and deadlines, score eligibility requirement precision and recall, and check how missing values are handled. |
| Deduplication | Use examples of the same opportunity across multiple pages and measure duplicate detection precision and recall. |
| Eligibility | Use fictional student profiles, check decisions against manually verified requirements, and track accuracy, per-class precision and recall, and the share of unsupported decisions. |
| Collection | Count websites checked, pages retrieved, valid opportunities extracted, duplicates removed, records needing review, and failures. Show the results in the demo if useful. |

## 11. Potential award tracks

| Track | Project fit | Technology |
| --- | --- | --- |
| Best Overall Hack | Complete academic opportunity platform | Core stack |
| Bright Data / Data for Good | Use public data to improve access to academic information | Bright Data |
| Gemini challenge | Extract page information and parse résumés | Gemini |
| Neon challenge | Store records and support application workflows | Neon |
| Mastra challenge | Automate multistep collection workflows | Mastra |
| Most Innovative Project | Automated discovery and personalized ranking | Overall system |

Verify eligibility, required technology usage, evidence, prizes, and submission rules against the official Devpost, MLH, and sponsor materials. The pitch centers on reducing the time and effort students spend finding academic and career opportunities through AI and public web data.

## 12. Risks and responses

| Risk | Response |
| --- | --- |
| Too many sources | Start with a small set of UCSD sources. |
| Expired listings | Retain source links and verification timestamps. |
| Extraction errors | Validate structured output and preserve unknown values. |
| Incorrect eligibility decisions | Use explicit rules and an unresolved/confirmation state; preserve the current API enum pending team confirmation. |
| Résumé privacy | Use synthetic résumés and minimize student data collection. |
| Integration problems | Agree early on APIs and the data contract. |
| Time pressure | Protect the MVP scope. |
| Limited UCLA data | Keep cross-campus comparison optional. |
| Sponsor API failure | Prepare a basic fallback implementation. |

## 13. Demo sequence

1. A fictional student opens Academic Compass and chooses interest areas and opportunity categories.
2. The student uploads a synthetic résumé. Gemini extracts skills, education, and research experience. The student confirms the result.
3. The dashboard shows relevant opportunities and lets the student sort by deadline or relevance.
4. Show the collector fetching a real public recruitment page with Bright Data, extracting structured data with Gemini, and saving the validated listing to Neon.
5. Show the new listing on the site. Open its original source, inspect requirements and the match explanation, and bookmark it.
6. If ready, show a UCSD–UCLA transparency comparison and explain which sources the data covers.

## 14. Post-hackathon roadmap

Expand to more universities, regions, and opportunity categories. Consider deadline reminders, calendar sync, research-interest matching, application assistance, AI academic planning, and cross-campus transparency research. Improve evaluation of the recommendation system as coverage grows.

## 15. Project mission

Help students discover, understand, and access academic and career opportunities. Combine public web collection, generative AI, structured storage, eligibility assessment, and ranking in one student-facing platform. Start with UCSD, support future university coverage, and build a foundation for Data for Good analysis.

The hackathon goal is a stable, demonstrable platform that automatically collects real opportunities and presents them in a personalized dashboard.
