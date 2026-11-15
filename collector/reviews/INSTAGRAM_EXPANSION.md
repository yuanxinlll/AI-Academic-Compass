# Student-organization expansion and human review

User requirement: expand the website to 30-50 real opportunities, use numeric
values for quantities, and support human verification. This run increased the website from
30 to 50 non-expired records (20 additions and one previously existing record refreshed).
Distribution: research 19, event 14, program 10, competition 5, internship 1, course 1.
Full validation attempted 105 unique posts; 35 structured records were retained locally,
including 21 API-matched non-expired records and 14 expired records excluded from additions. The requirement does not justify
inventing internships, forcing category balance, or treating recaps as openings.

## Coverage and files

- All 628 records in the current UCSD organization-directory scan were considered.
- 466 candidate handles were submitted in six bounded provider batches, at most
  three recent public posts each. This is not a complete Instagram history crawl.
- 433 candidates returned matching public author/coauthor evidence. The rest
  remain unavailable, unmatched or private; they are not promoted to readable feeds.
- 1,319 raw results became 1,226 unique authenticated-author/coauthor posts.
- Every unique post received caption screening: 434 candidates, 167 recaps,
  450 non-opportunities and 175 poster/uncertainty reviews. Category labels at
  this stage are preliminary. Only selected candidates received complete
  caption/poster extraction, evidence validation and database ingestion.

[Account and directory coverage](instagram-account-coverage-2026-11-15.json)
records the source identities and every directory disposition.
[Post classifications](instagram-post-classifications-2026-11-15.json) records
all preliminary decisions without treating them as approved opportunities.
[Structured opportunities and live readback](instagram-expansion-2026-11-15.json)
contains the actual database records and campaign results.

Raw provider responses, complete captions, poster images, OCR and runtime state
remain ignored under collector/output/instagram-expansion/. Public review exports
contain no API credentials, follower data or student principal-member information.
Bare social handles are labeled as candidates until exact public authorship matches;
affiliation is not university endorsement or proof of application eligibility.

## Human checks required

Open [the review CSV](HUMAN_REVIEW_2026-11-15.csv), with one row per current website
record. A person should check the original post/page and all poster slides:

1. Confirm that it describes a concrete opportunity and that its category fits.
   In particular, review the scope of arts training, civic-speaking opportunities
   and social-looking posts rather than assuming every organization post qualifies.
2. Check dates, printed times and current availability. Resolve caption/poster
   disagreements. Inferred years are labeled under [the date policy](../DATE_POLICY.md).
   An unresolved relative deadline such as Sunday of Week 1 is held for review.
3. Confirm eligibility completeness and distinguish requirements from preferences.
   JSON [] means unknown/unextracted, not proven absence of requirements.
4. Check numeric values and units together: GPA/hours are numbers; numeric
   durations retain units, minimum/consecutive qualifiers and ranges in raw_text.
5. Check that the application/RSVP method actually works. A link-in-bio reference
   without a recovered target is still uncertain; never invent QR destinations.
6. Enter reviewer, timezone-aware reviewed_at, corrections and approve_for_D.

No new record is marked verified by automated screening or by this CSV. D should
apply existing admin review only after a person confirms content and completeness.
The earlier verified database record is not evidence that this entire sample has
been human-checked. Full measured extraction accuracy still needs the planned
20-30 manually checked examples.

## B/D/C coordination

- B: consume the typed quantitative values together with raw_text units and
  uncertainty. Preserve inferred-year warnings; do not treat needs_verification
  records or missing requirements as automatic eligibility.
- D: records already travel through /api/admin/opportunities, with ADMIN_TOKEN
  private. IDs and source IDs are backend-owned. Deploy/resume collection at
  08:00 America/Los_Angeles only through the agreed deployment plan.
- C: use the existing API feed and source links. Preserve inference warnings
  from descriptions and distinguish public records from human approval.

## Reproduce

```powershell
python -B -m collector.instagram_campaign plan
python -B -m collector.instagram_campaign download
python -B -m collector.instagram_campaign classify
python -B -m collector.instagram_campaign collect --target 50
python -B -m collector.instagram_campaign export
python -B -m unittest discover -s collector/tests -q
```

The plan stage uses the existing directory snapshot. Download resumes saved job
IDs and does not trigger new scrapes. The six jobs for this run are recorded only
in ignored runtime state. Classification and collection use configured Gemini;
collection needs ADMIN_TOKEN. Only one provider-calling campaign should run at
a time: request pacing is process-local (12 requests/minute for the configured
15 RPM quota). 429 retry information is respected. No DATABASE_URL is needed.

The deployed scheduler, private/unavailable accounts, undiscovered handles and
unexamined historical posts remain outside the demonstrated coverage. No other
member code, shared schema or dependency was changed.

## Changed Member A files

- collector/main.py: numeric extraction/normalization and provider pacing/retry delay.
- collector/numeric.py: quantitative scalar conversion with original raw_text retained.
- collector/instagram_collection.py: unresolved relative deadlines held for review.
- collector/instagram_campaign.py: coverage, resumable processing, target cap and exports.
- collector/tests/test_instagram_campaign.py, test_numeric.py,
  test_provider_pacing.py and test_instagram_collection.py: 96-test suite coverage.
- collector/README.md, VALIDATION.md and this handoff: commands, results and limitations.
- The four linked review exports: structured records, account coverage, preliminary
  post classifications and the human-review CSV.

No teammate messages or human approvals were sent. D can review the existing
feature/collection PR, and B/C can use the deployed API and public review files.
