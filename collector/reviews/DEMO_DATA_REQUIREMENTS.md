# Demo data acceptance and A/B/D handoff

Latest team requirement supplied on 2026-11-15:
- 30-50 real UCSD opportunities, at least four categories, at least ten human reviews.
- hours_per_week and gpa requirement values must be JSON numbers, or null when unknown.
- Collect explicitly published department/discipline and project participation term;
  missing source information stays null. Never infer a term from posting/event dates.

## Current evidence

The live API returned 50 non-expired records across all six categories. Numeric
audit found zero non-number/non-null GPA or weekly-hour values. Missing and
ambiguous values still require confirmation rather than automatic eligibility.
The collector and ingestion adapter now both enforce numeric-or-null for these
two types; source quotations preserve ranges, strict comparators and units.

[Evidence-only matching metadata](matching-metadata-2026-11-15.json) joins to
existing opportunities by backend-generated opportunity_id and source_url.
It covers all 50 records: 14 department values, 29 discipline values and nine
participation-term values survived conservative evidence checks. Other values
are null. Every populated value carries an exact source quotation and a source
snapshot hash. These are automated, pending-review extractions, not human approval.

## Proposed shared fields: B/D confirmation required

The current docs/contracts.md Opportunity object and D's ingestion FIELDS do not
have dedicated fields for these concepts. To respect the shared interface,
Member A currently supplies a local sidecar, not extra public API properties.
Proposed nullable strings are department, discipline, project_term; names and
shape must be agreed with B/D in the shared contract before public ingestion.
For example, project_term may be exactly Winter and Spring with the year unknown.
Do not silently change that to a fully dated term or convert duration into term.

- A owns source extraction, exact evidence, numeric cleaning and the review queue.
- B should confirm the field names/representation its fixed algorithm consumes,
  join the sidecar by opportunity_id for testing, and treat null as unknown.
- D should confirm/update the shared schema/API/storage when the team agrees,
  preserve existing IDs and source links, and expose accepted fields to B/C.
- C should display source/uncertainty and verify the final demo cards after integration.

Do not reuse eligibility.type=major for general discipline: a subject or hosting
department is not automatically a hard applicant-major restriction. Likewise,
duration=two quarters is not evidence of which quarters a student can participate.
Student-organization names are not academic departments. Historical lab-meeting
dates and vague this quarter text are not confirmed current participation terms.

## Ten actual human checks still required

[The 50-row review CSV](HUMAN_REVIEW_2026-11-15.csv) now includes the three metadata
columns, their evidence and demo_review_priority. Rows numbered 1-10 are a
suggested first review set spanning all six categories. This is a work queue;
it does not record ten completed reviews.

Any teammate who actually opens and checks the sources can perform a review.
One person can review all ten; a second reviewer is not mandated by the supplied
requirement. Suggested distribution: A checks priority 1-5 and B checks 6-10.
B focuses on numeric requirements, subject relevance and term feasibility.
C/D can substitute if they check the full record, not just whether a link opens.
D applies admin approval only after a person checks the record's correctness,
current availability and eligibility completeness. Clicking approve without
checking the source is not a human verification. AI-assisted extraction and
this automated audit do not count as human reviews.

For each chosen row, open the original page/post and every poster slide. Confirm
title/category, relevance, availability, dates and inferred-year warning, all hard
and preferred requirements, numeric magnitude/units, department/discipline,
participation term and working application instructions. Enter reviewer,
timezone-aware reviewed_at, corrections and approve_for_D. Keep uncertain records
pending; do not mark verified merely to reach ten. Existing verified API status
alone does not document a fresh review against this checklist.

## Reproduce and scope

```powershell
python -B -m collector.matching_metadata
python -B -m unittest discover -s collector/tests -q
```

Source snapshots for all 50 records were available locally, so this enrichment
started no new scrape. Cached extraction is reused; missing sources stay unknown.
The command reads the public API and writes only A's metadata/review files. It
does not POST unapproved metadata or change the backend schema. 103 offline tests
passed. Changed files: collector/numeric.py, ingest.py,
matching_metadata.py, their tests, the review CSV and A's documentation.

Existing genuinely completed human reviews can count toward ten when their
reviewer and source-check evidence are documented; repeating them is unnecessary.
The current CSV is pending because no signed human-review results were supplied
in this session. An admin-set verified label alone does not establish who checked
which fields. The minimum is ten distinct opportunity records, not ten reviewers.
