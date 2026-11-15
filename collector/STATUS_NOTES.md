# Opportunity status and team handoff notes

> Current integration and coordination: [collection audit](PROJECT_AUDIT.md).
> Direct database writes below describe historical integration. The --ingest
> admin-API transport is now implemented and live-tested; see collector README
> and VALIDATION.md. These historical review notes do not grant admin approval.


Recorded: 2026-11-14. Counts below describe the last verified collection run,
not a fresh live database audit.

## What needs_verification means

The term is needs_verification, not "needs variation."

It means the opportunity record still needs review or approval. It does not
mean the listing is fake, the collection failed, or a student is ineligible.

Two different reasons currently share this status:

1. Nine new records have complete source reviews prepared by Codex but still
   await D's admin approval.
2. Fifteen other new records have unresolved details: current vacancies,
   private deadlines, conditional course routes, project-specific requirements,
   or stale recruitment statements.

Do not mark all records verified merely because they were fetched successfully.

## Keep the two status systems separate

| Field / result | Values | Meaning |
| --- | --- | --- |
| Opportunity status | verified, needs_verification, expired | Review state of the public listing itself. |
| Student eligibility status | eligible, ineligible, needs_confirmation | Whether one particular student meets that opportunity's requirements. |

A verified record has been checked against its source and its published
requirement list approved as complete. It does not guarantee admission, funding,
or that every student qualifies.

An expired record has a past deadline or evidenced closure.

B's current rules:
- An explicit hard requirement failure can produce ineligible even if the
  opportunity is not verified.
- Otherwise, an unverified opportunity produces needs_confirmation.
- A verified opportunity can produce eligible only when no hard check remains
  failed or unknown.
- Missing student information stays unknown; preferred qualifications do not
  disqualify a student.
- Empty requirement arrays mean nothing was extracted until completeness is
  verified; they do not automatically mean there are no requirements.

Example: Winkielman lists at least 6 hours/week and communication skills.
A student with 4 available hours fails the time condition. A student with enough
time and matching skills still receives needs_confirmation while the listing
awaits verification. The verified local test copy produced eligible when its
hard conditions were met.

## What has been achieved

- Inspected 32 official UCSD pages.
- Added 24 new source-reviewed records to Neon.
- Excluded 8 filled, closed, past-cycle, or obsolete pages.
- Last checked real UCSD dataset: 27 records total, including the original
  expired CAMP record; seed/test rows are additional.
- All 24 new rows remain needs_verification pending the decisions above.
- Verified database readback, unique source URLs, stable IDs and initial
  collection timestamps, and visibility through the deployed public API.
- 32 collector tests passed.
- Four checks against B's actual adapter passed: unverified gating, a locally
  verified positive case, insufficient time, and unknown skills. The verified
  copy was a local fixture, not a live database approval.

## Next action for D and B

D should review the nine complete candidates and approve appropriate ones through
PATCH /api/admin/opportunities/{id}. During the last check, collector/.env had
no ADMIN_TOKEN. The current token must be configured privately to use the helper;
no secret belongs in this note, Git, or chat.

From the repository root:

```powershell
# Read-only check: lists the nine candidates and refuses changed public records.
collector/.venv/Scripts/python.exe -B -m collector.approve_reviews

# Only after the operator confirms source/requirement review and configures
# the current ADMIN_TOKEN privately:
collector/.venv/Scripts/python.exe -B -m collector.approve_reviews --apply
```

Do not approve the other fifteen until their specific uncertainties are resolved.
After approval, B should rerun live matching on the real records; unsupported
conditions may still require confirmation even when the listing is verified.

## Files to share

- [Detailed B/D handoff and the nine database IDs](reviews/B_HANDOFF.md)
- [Public records, source quotations, and individual review notes](reviews/ucsd-opportunities-2026-11-14.json)
- [Collector setup and run commands](README.md)
- [Validation history](VALIDATION.md)

The expanded handoff was pushed on feature/collection in commit f194890.
This note is local workspace documentation; no credentials are included.
