# Collector verification ? 2026-11-14

The collector implementation remains scoped to collector/. Shared contracts,
Next.js routes, database schema, and other members' code were not changed.

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
  ?8.1 assigns direct Neon writes to A's script. The adapter uses that branch's
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
later 20?30 listing accuracy evaluation.

## Remaining deployment dependency

The team's Neon connection is not configured in collector/.env. A real Neon
save, existing-database permissions, and dashboard display have not been tested.
D must supply a collector-authorized DATABASE_URL for its already-created
schema. The script checks columns and requires TLS before collection.

After configuring it, run twice:

```powershell
collector/.venv/Scripts/python.exe -m collector.main --url https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html --database
```

Verify the same opportunity_id and first_collected_at, one opportunity row,
and one collection_logs entry per run. C/D can then verify the existing
GET /api/opportunities displays the new record. Do not rerun D's destructive
schema setup against a populated database.

The optional POST /api/collect route is D-owned and not mounted by this change.
collector/api.py provides the Python logic; direct CLI collection is sufficient
for the hackathon architecture.

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
