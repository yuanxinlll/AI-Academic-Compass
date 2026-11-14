# Member A ? opportunity collection

Run from the repository root with Python 3.11+. Bright Data and Gemini requests
use your configured provider accounts. Collection uses the standard library.
Only PostgreSQL mode requires the dependency in requirements.txt.

Copy collector/.env.example to collector/.env and fill it locally. The CLI
automatically loads collector/.env; existing process environment values take
precedence. Never commit the real .env. Output and monitoring state are ignored.

## Collect and discover

Collect one real program:

```powershell
python -m collector.main --url https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html
```

Discover detail pages from a trusted directory, with a strict request budget:

```powershell
python -m collector.main --url https://ugresearch.ucsd.edu/programs/urh-academic-year/index.html --discover --max-pages 4 --max-depth 1
```

Use --sources collector/sources.json for the supplied seed list. --url can be
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

Ctrl+C stops monitoring. Every run refetches pages. Unchanged readable text
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

## Save to Neon

D's backend branch defines direct Python-to-Neon collection in
docs/contracts.md ?8.1. The adapter matches that branch's existing
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
for the hackathon; the direct database script is the primary integration.

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
