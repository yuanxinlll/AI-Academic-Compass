# Member A - opportunity collection

> Current integration audit: [PROJECT_AUDIT.md](PROJECT_AUDIT.md). Latest fetched
> main requires admin-API ingestion. Use --ingest for the implemented HTTP
> transport; --database is legacy. A deployed periodic scheduler remains pending.

Run from the repository root with Python 3.11+. Bright Data and Gemini requests
use your configured provider accounts. Collection uses the standard library.
Only PostgreSQL mode requires the dependency in requirements.txt.

Copy collector/.env.example to collector/.env and fill it locally. The CLI
automatically loads collector/.env; existing process environment values take
precedence. Never commit the real .env. Output and monitoring state are ignored.

## Unified registry and category-aware discovery

[source_registry.json](source_registry.json) is the authoritative internal URL
inventory: discovery groups, directory/detail roles, source page types, stage,
enabled monitoring, provenance and last-check/error context. Registry stages are
seed, candidate, collected and source_reviewed; none grants verified status.
Discovery groups guide exploration, not the Opportunity.category field.

```powershell
# Independent budget of up to three pages for EACH of the six groups.
python -m collector.registry --pages-per-group 3 --max-depth 1 --ingest

# Focus a run, without letting research links consume its budget.
python -m collector.registry --groups internship,event,competition,course --pages-per-group 4 --ingest

# Recheck enabled collected/source-reviewed detail pages, without discovery.
python -m collector.registry --mode monitor --pages-per-group 10 --ingest

# Regenerate legacy URL-only inputs; no network or paid provider calls.
python -m collector.registry --export-lists
```

Maintain source metadata in the registry. sources.json, reviewed_sources.json and
candidate_sources.json are generated compatibility views, no longer independently
maintained queues. Existing --sources commands still work. The registry runner
uses output/registry/state.json and writes opportunities.json and report.json
there. Run one worker per state file. A separate scheduler is still needed.

Directories are discovery-only. Group-specific URL ranking skips login/actions,
staff navigation and malformed links; each group gets its own bounded budget.
New internal links retain their parent URL and discovery group. A successfully
collected candidate becomes monitorable; source review and human approval remain
separate. All records retain their content-based category, even if a program was
found through an internship directory. Reports distinguish actual categories
from discovery effort; equal budgets do not guarantee equal record counts.

Current fetching still accepts only public HTTPS UCSD-domain URLs. Off-domain
links are recorded in external_candidates for trust/relevance review, not fetched
or presented as opportunities. This is a remaining transport policy limit, not
the definition of UCSD relevance. No login, registration or confirmation actions
are followed. Multi-offering pages must supply separate detail URLs under D's
current unique-source-url contract. Explicit, evidenced past activity end dates
can mark records expired without inventing an application deadline; transient
activity-date extraction fields never enter the public schema.

See [discovery handoff](reviews/DISCOVERY_HANDOFF.md) for the live test, added
records and remaining category/identity gaps.

## Collect and discover

Collect one real program:

```powershell
python -m collector.main --url https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html
```

Discover detail pages from a trusted directory, with a strict request budget:

```powershell
python -m collector.main --url https://ugresearch.ucsd.edu/programs/urh-academic-year/index.html --discover --max-pages 4 --max-depth 1
```

Use --sources collector/sources.json for the registry-generated seed list. --url can be
repeated. Only HTTPS UCSD links are eligible. Discovery resolves relative links,
removes fragments, excludes common assets and external domains, and prioritizes
program detail pages. Depth is capped at 5, pages at 100; defaults are 1 and 5.
Known URH directory pages are discovery-only, not opportunity records. Remaining
links are listed in the report; broader search-engine discovery is not included.

Outputs:
- collector/output/opportunities.json: validated records across monitored sources.
- collector/output/state.json: content hashes, last-good records, normalized
  source text for audits, discovered links, and per-source failures.
- collector/output/report.json: run counts, errors, pending URLs, persistence mode.

The state file is for one worker. Do not run concurrent jobs with the same
state/output paths. Different source sets should use separate state paths if
their exports must be isolated.

## Monitor

```powershell
python -m collector.main --sources collector/sources.json --interval 3600
```

This loop requires a continuously running local process; no deployed scheduler
is verified. Ctrl+C stops monitoring. Every run refetches pages. Unchanged readable text
reuses validated extraction; --force requests fresh Gemini extraction. Extractor
version changes also invalidate cached extraction. Local first_collected_at is
preserved. Each provider request has a 90-second timeout and at most three
attempts for transient network/429/5xx errors. Invalid extraction receives one
corrective Gemini retry. Separate sources continue after an individual failure;
a one-shot run exits nonzero if any source failed.

## Validation and duplicates

Output follows docs/contracts.md ?2. Eligibility uses structured objects and
contiguous source quotations. HTML entities and whitespace are normalized for
quotation comparison; paraphrased quotations are rejected. Deadlines use
YYYY-MM-DD. A deadline must match a complete date in its source quotation;
unsupported inferred dates become null, preserving deadline_text. Explicitly
past dates or evidenced application closures yield expired. Other records stay
needs_verification, regardless of successful extraction. last_verified_at means
the source was checked, not that a human approved the opportunity.

Missing scalar values are null and arrays are empty. System-owned IDs and
timestamps come from the collector/database, never Gemini. Human review is still
needed for quote-to-field meaning, conflicting source information, and extraction
completeness. Do not treat model output as a student eligibility decision.

Same-page repeated titles are removed. Distinct opportunities sharing one URL
are rejected because the team contract makes source_url unique; collect their
individual detail pages. Cross-page deduplication is deliberately conservative:
only records with identical extracted fields (including deadline and eligibility)
are merged, and only when organization/description are present. Aliases remain
visible in state. Other possible duplicates require review.

A source failure retains last-good local records with needs_verification; known
expired records remain expired.
Previously collected opportunities disappearing from a page are flagged for
review rather than silently removed. Failed fetches do not advance the record's
verification timestamp. Known directory pages never retain a record.

## Save through D's admin API

Configure ADMIN_TOKEN privately in collector/.env. DATABASE_URL and a database
Python driver are not needed for this mode. The target defaults to the deployed
Academic Compass app; COLLECTOR_API_BASE_URL or --api-base-url can select another
HTTPS origin. The token must match that deployment's server-side ADMIN_TOKEN.
Never put the token in command-line arguments or source control.

```powershell
python -m collector.main --url https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html --ingest --source-type listing
```

This runs fetching, extraction and evidence validation before POSTing to
/api/admin/opportunities. IDs and timestamps are omitted from the request;
backend-generated opportunity IDs are copied back into local records. Database
source IDs and authoritative timestamps are available through public API readback;
local timestamps remain collection-state timestamps, not database readback.
--source-type accepts lab_page, department, calendar, listing or other; these are
page types, separate from the six opportunity categories.

The client refuses credential-forwarding redirects, uses 30-second HTTP timeouts,
and retries transient network/429/5xx failures at most three attempts. URL upserts
make retries safe from duplicate opportunity rows; logs/timestamps may still be
refreshed. Partial rejections are reported as errors and make the CLI exit nonzero,
while successful save counts and IDs are retained. A 401 is not retried. Tokens
and arbitrary remote error bodies are excluded from reports.

Report persistence is admin_api. inserted/updated/duplicates use D's response:
duplicates overlaps updated (an existing URL upsert), so do not add those counts
together. Per-page outcome describes the local extraction comparison. Local
JSON exports can include rejected or retained last-good records: use save counts,
errors and public API readback to assess what was actually persisted.

D's API requires 1-50 opportunities per submission. Empty directory pages and
failed fetches are recorded locally with an explicit persistence warning; this
endpoint cannot log them or remotely mark an old row uncertain. D coordination
for that telemetry remains pending. No dummy opportunity is submitted.

The live integration test writes the real FMP opportunity twice and checks public
readback, stable IDs and preserved first collection time:

```powershell
python -B -m collector.tests.run_api_integration
```

This test uses configured provider accounts and saves to the configured deployment.
It does not approve records as verified. See VALIDATION.md for recorded results.

## Legacy direct Neon adapter (historical integration)

This implements the earlier Python-to-Neon integration, superseded by latest
main's POST /api/admin/opportunities contract. Do not treat this command as the
current production handoff. The adapter matches the existing
lib/database/schema.sql tables. It does not execute D's schema script or make
schema changes.

```powershell
python -m pip install -r collector/requirements.txt
# Set DATABASE_URL in collector/.env using D's collector-authorized credentials.
python -m collector.main --url https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html --database
```

The adapter checks existing columns before paid provider calls, requires TLS,
and writes sources, opportunities, and collection_logs in a transaction per
source. Parameterized upserts use source_url, preserve database-generated
opportunity_id and original first_collected_at, update verification fields,
and log failures. It never reads or writes student tables. Repeated database
runs update the same opportunity; report counts come from database comparisons.
Local JSON mode is explicitly reported as local_json and is not a Neon save.

## Optional collection endpoint handoff

D owns app/api/. The optional collector/api.py provides
collect_request(payload, admin_token), returning (JSON body, HTTP status).
It validates ADMIN_TOKEN in constant time before database/provider calls and
accepts exactly one of url or source_id. D can mount it behind POST /api/collect
when a Python execution environment is available. No standalone service or
Next.js route is created here. The CLI can also consume one JSON request on
stdin via python -m collector.api and print a status/body envelope. Keep
headers, tokens, and the subprocess call on the server. This endpoint is optional
as a trigger; latest main specifies admin-API ingestion as the primary integration.

## Checks and remaining integration

```powershell
python -B -m unittest discover -s collector/tests -v
```

See VALIDATION.md for real-source observations and verified Neon insert/upsert
results. The expanded review manifest is not a general extraction-accuracy benchmark.

Provider documentation:
- https://docs.brightdata.com/products/web-unlocker/send-your-first-request
- https://ai.google.dev/api/generate-content
- https://www.psycopg.org/psycopg3/docs/basic/params.html

## Expanded data handoff

See [B/D data handoff](reviews/B_HANDOFF.md) for 24 additional UCSD records,
source-review decisions, representative eligibility cases, and pending admin approval.
