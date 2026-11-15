# Collection audit and team decisions

Checked 2026-11-14 after fetching origin. This is the current coordination record;
older validation documents describe historical runs, not production readiness.

## Repository and runtime evidence

- Current branch: feature/collection, tracking origin/feature/collection at f194890.
- Latest fetched main: ffb2792; backend: 0324c56. Collection and main differ by
  4 collection-only and 20 main-only commits at the original audit. The subsequent
  governing-file update fetched again and merged origin/main without conflicts
  as e42d28d, preserving local collector notes.
- Latest main docs/contracts.md section 4.5 specifies authenticated POST
  /api/admin/opportunities ingestion. Python now supports --ingest through collector/ingest.py, live-tested with FMP;
  --database remains a legacy option.
  The local contract now contains the merged ingestion agreement. Shared root
  README still contains historical direct-Neon descriptions.
- Deployed GET /api/opportunities?limit=100 returned 200 and total 33 (default
  feed excludes expired). An unauthenticated admin POST returned 401; no write occurred.
- Last read-only database audit: 34 total rows, including 7 seed/other rows.
  The 27 records whose source host is UCSD comprise research 19, program 7,
  course 1, internship 0, event 0, competition 0. One is expired; 26 need
  verification. Host-based counting does not establish eligibility or open recruitment.
- The 24 added records have source evidence and review notes; nine are prepared
  for human review, not production-approved. B's local positive test used a
  verified fixture. No deployed periodic collector has been demonstrated.

## Where exploration actually began

1. User-provided entry point: https://ugresearch.ucsd.edu/ .
2. First automated discovery base:
   https://ugresearch.ucsd.edu/programs/urh-academic-year/index.html .
3. First detail-page integration test:
   https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html .
4. Additional manually explored directories:
   https://ugresearch.ucsd.edu/programs/all-urh-programs/index.html and
   https://ugresearch.ucsd.edu/programs/all-ucsd.html .

The original sources.json contained only the academic-year directory and FMP detail page.
reviewed_sources.json contains 24 selected pages. The original candidate_sources.json contained
nine pending links. These lists originally served different stages. They are now generated views of
source_registry.json, the authoritative URL inventory with provenance and stages. Runtime state also retains discovered
URLs. There is no integrated search-engine discovery: subsequent lab searches
were performed manually during this work.

## Why research dominates

The corpus reflects selection bias, not a measured distribution of UCSD offerings.
The starting hub and directories specialize in undergraduate research. Expansion
then emphasized lab-join and research-assistant searches to give B concrete hours,
skills and coursework cases. The discovery scorer favors research/program/join
paths, including URH program paths; its default budget is five pages and one hop.
No comparable independent internship, event, competition or course seed groups
were established. Six supported category labels cannot correct missing sources.
Do not relabel research positions as internships merely to balance counts.

Original coverage limits: HTTPS ucsd.edu-only URL validation excluded official
external destinations. The subsequent student-org task added 14 verified website
scopes in student_org_sources.json; arbitrary external destinations remain blocked.
See reviews/STUDENT_ORG_SOURCES.md. Existing extraction hardcodes university=UCSD. Source hosting,
organizer identity and applicant eligibility are distinct facts. A UCSD-hosted
page may exclude UCSD students; an external employer may accept them. The
one-opportunity-per-source-URL rule also prevents ingesting several independent
roles from a shared page; discover individual detail pages first.

## Scope clarified by the latest user-supplied Chinese plan

Collect public academic and career-development opportunities relevant to UCSD
undergraduates across research, internship, event, competition, program and course.
Include university-run offerings, company/research-institute internships and
campus jobs relevant to UCSD undergraduates. Preserve organizer and source identity; do not infer
eligibility from the website domain. Prefer primary sources, following explicitly
trusted official external destinations under an agreed URL policy. Use independent
category seed groups and per-group discovery budgets, report coverage gaps, and
retain uncertain dates, eligibility, closure and waitlist information faithfully.
Never force equal category counts or invent evidence to fill a category.

The Chinese plan confirms all six categories, company internships and campus
jobs. Research-only or UCSD-host-only collection is not a product limit. General
global-job coverage and paid-resource boundaries remain policy questions; do not
block clearly included opportunities while resolving those edge cases.

## Refinements and coordination register

| Owner | Action or decision | Proposed resolution / acceptance evidence |
| --- | --- | --- |
| A | Admin-API ingestion implemented and live-tested | --ingest omits system fields, authenticates privately, batches at 50, handles rejections and saved IDs, and retains local JSON mode. D validates API field limits; upstream Python validates extraction evidence. Fresh FMP update and repeated public readback passed without DATABASE_URL. Brand-new URL insertion not exercised in this test. |
| A + D | Empty discovery pages and failed collection attempts cannot be logged through the current ingestion endpoint, which requires at least one opportunity | Agree supported telemetry before replacing direct DB logging. Never create dummy opportunities to obtain a log entry. |
| A + D | Reconcile persistence/reporting semantics | D reports duplicates as updates; local code distinguishes unchanged records. Define counters, source registration, retries and partial success behavior. |
| A | Correct source classification and centralize discovery inputs | Current storage adapter labels every new source listing. Assign supported source types. Implemented source_registry.json and registry.py with independent group budgets, provenance and generated compatibility lists; see reviews/DISCOVERY_HANDOFF.md. Registry is A-owned metadata, not a new public opportunity field. |
| Team + A | Define UCSD relevance and coverage | Chinese plan confirms the UCSD undergraduate audience, company internships, campus jobs and six categories. Clarify ambiguous global-listing/paid-resource edge cases without blocking the explicit scope. Establish category discovery targets rather than equal final record counts. |
| A + B + D | External-source field meaning | Agree university meaning for external employers and explicit eligibility representation. Change no shared fields/enums without approval. Separate domain trust from applicant relevance. |
| A + D | Several roles on one URL | Use canonical detail URLs where possible. Escalate genuine shared-URL identity conflicts; no fragment aliases or schema changes by A alone. |
| D + A | Periodic operation and credentials | D supplies a server-side admin credential, deployment/scheduler choice and access boundary. Agree interval, provider budget, durable state, overlap prevention, retries and monitoring. Local --interval is only a running process, not deployed automation. Do not deploy credentials to the frontend. |
| D / human reviewer + B | Approval and live matching | Human-review nine prepared candidates, resolve remaining uncertain records individually, then have B test the live approved rows. Successful fetch/extraction is not verification. |
| Team / shared-doc owners | Reconcile shared docs and branches | Latest main merged without conflicts; rules and plan now live in repository AGENTS.md and docs/hackathon-plan.md with parent workspace pointers. Chinese student pending enum conflicts with current API: team confirmation remains needed. Shared README architecture/count reconciliation remains pending. |

## Ownership and completion boundaries

A owns source discovery, extraction, cleaning, classification, evidence, uncertainty
tracking and conservative deduplication. D owns API/database validation and
persistence, authentication and deployment. Both layers may deduplicate for their
own boundary; A should not change schema or D's routes unilaterally. C owns display
and B owns student eligibility/ranking. The original audit changed documentation only. The later governing-file update
merged main and clarified scope and change-approval rules, without changing API
shapes, enums, schema or collector behavior. Existing workspace notes were
preserved. No push or cleanup was performed.

Next implementation order: agree empty/failure logging behavior; expand category coverage from the implemented registry;
verified source coverage; approve records and verify the scheduled end-to-end run.
