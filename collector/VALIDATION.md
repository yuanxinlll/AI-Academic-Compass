# Collector verification - 2026-11-14

> Current integration and coordination: [collection audit](PROJECT_AUDIT.md).
> Direct database writes below describe historical tests. Admin-API ingestion
> is now implemented and live-tested as described immediately below.


The collector implementation remains scoped to collector/. Shared contracts,
Next.js routes, database schema, and other members' code were not changed.

## Student-organization sources - 2026-11-15 UTC

- Read all 628 current UCSD CSI records; 467 have a social field. Retained no
  principal member names/student emails. Verified cross-links from UCSD academic
  department/organization pages and targeted online searches.
- Fourteen readable website sources enabled with exact host/path scopes. Twenty-two
  explicit Instagram references checked; public posts were not readable with the
  current fetch method, so no Instagram feed was enabled. Other social references
  remain an unresolved research queue, not inferred/verified Instagram accounts.
- Exact identity matching rejected similarly named organizations; offline/parked,
  generic institutional footer links, unrelated redirects, login/JS-only pages
  were not promoted to readable sources. Real JS sites remain pending rendering.
- 61 offline tests passed: scope boundaries, no host-suffix/shared-host escapes,
  exact identity, no member/email retention, disabled-source handling, seed
  rotation and all existing extraction/API integration regressions.
- Refined live IEEE crawl: four retrieved pages, two records, one inserted and
  one updated, no errors. Quarterly Projects classified as program with unknown
  deadline; TritonBots RoboCup SSL classified as competition and expired with
  source-supported 2025-10-10 deadline. Public API readback matched both records.
- The initial IEEE run withheld a validation failure; that evidence remains in
  output/student-org-live/initial-report.json. A fresh valid extraction later
  saved the program. No record was approved merely from source affiliation.
- Versioned evidence: student_org_sources.json, reviews/STUDENT_ORG_SOURCES.md,
  reviews/student-org-opportunities-2026-11-14.json. Runtime state/provider output
  stays ignored. No B/C/D code, schema, dependency or deployed scheduler changed.

## Registry discovery - 2026-11-14 Pacific / 2026-11-15 UTC

- 52 offline tests passed after registry/pipeline implementation and live findings.
- First six-group run exposed a malformed source href, an event confirmation URL,
  and multi-offering extraction failures. Malformed/action links are now filtered;
  their initial evidence is retained, not submitted as opportunities. The known
  multi-offering Carpentries page is discovery-only rather than merging its roles.
- Refined live run: 17 fetched pages (budget at most 18), all six discovery groups,
  no extraction/persistence errors. Six upsert operations across groups; overlapping
  revisits are not six unique opportunities. Local state contains five unique
  records: four programs and one event, including previously stored records.
- Across the two runs: three new records (UCCS expired program, AIP Enrollment
  Workshop event, Basement Affiliate Student Organization Program). FMP/EMPOWER
  already existed. New entries remain unverified or expired, never admin-approved.
- Evidence: ignored output/registry/initial-report.json, report.json and state.json;
  versioned source_registry.json and reviews/DISCOVERY_HANDOFF.md describe findings.
- No standalone internship/competition/course was established by this test. That
  coverage gap is reported explicitly. External links require review; source URL
  identity prevents merging independent offerings on one page. No deployed cron,
  search-engine discovery or measured extraction-accuracy benchmark was added.

## Admin-API integration - 2026-11-14 Pacific / 2026-11-15 UTC

- Implemented collector/ingest.py and CLI --ingest; no new dependencies or D files.
- 42 offline tests passed, including payload/system-field boundaries, partial
  rejection handling, 50-item batch limits, safe errors, transient retry,
  authentication failure, redirect refusal and pipeline persistence.
- Confirmed collector/.env has ADMIN_TOKEN and no DATABASE_URL, without displaying
  values. Authenticated empty POST reached input validation (400), saving no rows.
- Fresh real FMP fetch + Gemini extraction + normalization + API POST passed:
  1 retrieved page, 1 opportunity, 0 inserted, 1 updated, 0 rejected, no errors.
  This exercised updating a real existing record, not creating a synthetic row.
- Two subsequent real fetch/API-upsert runs passed with cached extraction.
  Public API readback matched title/category/description/requirements/deadline/
  application fields. ID 7b90bc53-3b76-4767-ac84-aa2df770dd5d, source ID and original
  first_collected_at were preserved; last_verified_at refreshed. No SQL access used.
- D reports duplicates=1 alongside updated=1 for repeated source URLs; these are
  overlapping counters. No extra opportunity row was created.
- Evidence: ignored output/api-ingest-report.json and
  output/api-ingest-verification.json. Reproduce with
  python -B -m collector.tests.run_api_integration (live writes/provider usage).
- Not verified by this test: insertion of a brand-new URL, deployed scheduling,
  or remotely logging zero-result/provider-failure attempts. Such attempts remain
  local because the ingestion contract requires nonempty opportunities.


## Verified

- 28 offline tests passed: contract fields, source evidence, dates, explicit
  closures, directory rejection, bounded discovery, duplicates, changes,
  failed sources, corrective retries, and admin request validation.
- Bright Data retrieved real UCSD pages; Gemini extracted structured records.
- A four-page discovery run started from the academic-year directory and
  collected three distinct program records with no errors.
- Repeat collection reused unchanged extraction and preserved record identity.
  A changed EMPOWER page was re-extracted.
- D's backend branch (7325512) was inspected without merging it. Its contract
  section 8.1 assigns direct Neon writes to A's script. The adapter uses that branch's
  sources, opportunities, and collection_logs table definitions.
- Disposable PostgreSQL 17 tests passed for insert, duplicate upsert, update,
  stable database-generated ID and first timestamp, JSON/date round trips,
  source lookup, failure logging, and transaction rollback.
- Three real collected records were saved and read back from test PostgreSQL.
- A complete live FMP run fetched through Bright Data, extracted through Gemini,
  validated the result, and saved through PostgresStore into isolated PostgreSQL.
  A second live fetch/upsert preserved the database ID and initial timestamp.
- Test containers were removed after each run. No schema script was run against
  Neon. The PostgreSQL driver was installed only in ignored collector/.venv.

## Manual source review

These observations concern the sampled pages, not a general accuracy estimate.

| Source | Result and review |
| --- | --- |
| [FMP](https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html) | Application deadline 2026-12-18 agrees with the application-date table. Extracted eligibility covers GPA 2.7, sophomore standing or above, 12 hours/week, both winter and spring quarters, and UCSD undergraduate enrollment. The earlier departmental registration date must not replace the main application deadline. |
| [CAMP](https://ugresearch.ucsd.edu/programs/all-urh-programs/camp/index.html) | The source says spring and summer applications are closed; status is expired and deadline is null. Extracted student, unit, GPA, and STEM criteria have source quotations. This general program page combines tracks; do not infer that it describes a currently open cohort. |
| [EMPOWER](https://ugresearch.ucsd.edu/programs/all-urh-programs/empower/index.html) | The retrieved page contains conflicting or stale application-date statements. Deadline remains null and status needs_verification. Do not promote it as currently accepting applications without checking with the program. |

These are program records, not invented lab vacancies. All record-level
verification remains conservative. Three samples do not satisfy the plan's
later 20-30 listing accuracy evaluation.

## Neon integration verified

On 2026-11-14, the configured Neon connection passed the existing-schema check.
A forced live FMP collection fetched through Bright Data, extracted with Gemini,
validated the result, and inserted one real opportunity into Neon.

Two subsequent bounded discovery runs checked the academic-year directory plus
CAMP, EMPOWER, and FMP, using the production adapter against the configured Neon
database:

| Run | Records found | Inserted | Updated | Duplicates | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| First discovery/save run | 3 | 2 | 0 | 1 | 0 |
| Repeat discovery/save run | 3 | 0 | 0 | 3 | 0 |

Database readback verified exactly one opportunity row per program source,
structured eligibility JSON, associated source IDs, preservation of the existing
FMP opportunity_id and first_collected_at, and exactly two additional collection
logs per source across these two runs. No tables were created, dropped, or
altered. No private student tables were accessed. The local machine-readable
verification result is in ignored collector/output/neon-verification.json.

The member A core collection success criterion is now demonstrated against
Neon: real-source discovery, fetching, extraction, validation, duplicate handling,
and database saving. The separate project-wide 20-30 listing accuracy study
remains a broader evaluation task; this three-program sample does not establish
general extraction accuracy. Dashboard display remains C/D's integration work.

To collect again:

```powershell
collector/.venv/Scripts/python.exe -m collector.main --sources collector/sources.json --discover --max-pages 4 --max-depth 1 --database
```

The optional POST /api/collect route is D-owned and not mounted by this change.
collector/api.py provides the Python logic; direct CLI collection is sufficient
for the hackathon architecture. Credentials stay in ignored collector/.env.

## Reproduce database tests

Requires Docker Desktop running, the backend tracking ref fetched for its
schema fixture, and the PostgreSQL dependency installed:

```powershell
collector/.venv/Scripts/python.exe -B -m collector.tests.run_postgres_integration
# Also exercise the live provider-to-database flow (uses provider quota):
collector/.venv/Scripts/python.exe -B -m collector.tests.run_postgres_integration --live
```

The harness starts a random, loopback-only, disposable PostgreSQL container,
applies only the three collection CREATE TABLE definitions in that container,
and removes the container afterward. It never uses DATABASE_URL or touches Neon.
The production adapter requires TLS; only the isolated test subclass disables
TLS for its loopback connection.

## Expanded B data handoff

A subsequent 2026-11-14 source review inspected 32 official UCSD pages and added
24 records to Neon. Eight closed, filled, past-cycle or obsolete pages were
excluded rather than advertised as active. All 24 new records passed contract
and quotation checks and are visible in the deployed public API.

The source-reviewed manifest and B-specific cases are in
[reviews/B_HANDOFF.md](reviews/B_HANDOFF.md). Nine complete reviews are ready
for D's admin approval, but no ADMIN_TOKEN is configured locally. Consequently
all 24 new database records still have needs_verification; source review is not
being presented as human/admin approval.

A persistence recheck inserted zero rows, preserved all 24 IDs and initial
timestamps, and updated one conditional GPA correction while recognizing the
other 23 saves as duplicates. The dataset now has 27 real UCSD records, including
the existing expired CAMP entry. Seed/test records were not modified.

All 32 current offline tests pass. B's real matching adapter also passed four
isolated tests on the new Winkielman record: unverified stays pending, a local
verified copy can be eligible, insufficient time is ineligible, and unknown
skills stay pending. No production verified-to-eligible claim is made until
admin approval is applied. No student profile was written for these tests.
