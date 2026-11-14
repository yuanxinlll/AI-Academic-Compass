# Collection MVP

Python 3.11+, standard library only. Run from the repository root.

```powershell
$env:BRIGHTDATA_API_KEY = 'your-key'
$env:BRIGHTDATA_ZONE = 'your-web-unlocker-zone'
$env:GEMINI_API_KEY = 'your-key'
$env:GEMINI_MODEL = 'your-enabled-model-name'
python -m collector.main --url 'https://YOUR-SOURCE.ucsd.edu/openings' --output collector/output/opportunities.json
```

Select a real public UCSD page with explicit opportunities before running.
Requests use paid provider accounts. Credentials are read only from the environment.
Never commit credentials or generated records without review.

The collector fetches through Bright Data, asks Gemini for JSON, validates it,
removes duplicate titles within a category on the supplied page, and skips
explicitly expired deadlines. Failures leave the previous output intact.
Missing dates remain null; records remain needs_verification pending review.
Deadline quotations are checked against page text, but human verification is
still required to check that the date belongs to the opportunity.

Output is a JSON array for D's integration, with shared opportunity fields
except opportunity_id, which the database generates on insert. No API or database
schema is introduced. D must agree on the ingestion mechanism and implement
idempotent upserts (source_url plus normalized title is a starting identity).
File output alone is not database persistence.

Current limits: one explicitly supplied source per run, no automated link
discovery, no scheduler, no cross-source fuzzy deduplication, and no database
connection. Reviewing source availability and obtaining provider credentials
are required before a live integration demonstration.

Provider references:
- https://github.com/brightdata/skills/blob/main/skills/bright-data-best-practices/references/serp-api.md
- https://ai.google.dev/api/generate-content

Run offline checks: `python -m unittest discover -s collector/tests -v`.

## Team handoff ¡ª 2026-11-14

Validation completed:
- Four offline unittest checks passed.
- Live Bright Data retrieval of https://ugresearch.ucsd.edu/ succeeded (76,376 characters).
- Gemini processed the fetched homepage and returned zero opportunities.
- A separate synthetic opening produced one valid research record with a null deadline.
- No real opportunity has yet been saved to Neon.

Integration blockers: this prototype follows the earlier AGENTS.md contract.
The newer docs/contracts.md expects structured eligibility objects, date-only
YYYY-MM-DD deadlines, and additional opportunity fields. The collector currently
outputs eligibility strings and timestamp deadlines. Do not ingest output into
the newer database contract until these differences are reconciled with D.
Also agree how to represent multiple listings on one source page, because the
newer contract makes source_url unique. No shared contract files were changed.

Next: collect and manually verify a real opening, align the collector with the
agreed contract, then connect D's ingestion and C's dashboard.

Local configuration may be stored in collector/.env (ignored by Git). The
collector does not load that file automatically; export its values into the
process environment before running. Never share the real file or API keys.
