> v1.1 update: the contract is now confirmed. The authenticated FastAPI service is services/main.py; see ../README.md. Earlier draft blockers below are retained as history and no longer block implementation. Deployment and cross-member acceptance remain pending.

# Cross-member contract alignment

## Observed repository state

Read from fetched remote branches, without merging or modifying another module:

- `origin/main`: Next.js skeleton and `docs/contracts.md` now exist.
- `origin/feature/backend`: database helpers and GET /api/opportunities exist.
  Relevance sorting currently falls back to deadline sorting. No profile/resume/
  match route is present in this branch's file inventory.
- `origin/feature/collection`: collector prototype exists. Its README explicitly
  reports old-format eligibility strings and timestamp deadlines, zero real
  opportunity records saved to Neon, and pending contract alignment.

## Blocking differences

| Concern | Current B internal format | New D draft | Proposed resolution |
| --- | --- | --- | --- |
| Pending eligibility | needs_verification | needs_confirmation | Team must choose; original planning document requires needs_verification |
| Opportunity requirements | string[] | typed objects with type/value/raw_text/is_hard_requirement | Add a B adapter after typed semantics are approved; preserve raw text |
| Academic year | integer 1-4; education level separate | freshman/sophomore/junior/senior/graduate | Explicit boundary mapping; never infer from graduation date |
| Weekly time | weekly_hours_available | hours_per_week | Adapter mapping, no database rename |
| Courses | completed_courses | courses_taken | Adapter mapping |
| Graduation | expected_graduation_date, full date | expected_graduation, year-month | Preserve partial dates; never fabricate a day |
| Experiences | experience_type/title/description/skills | type/title/organization/description | Adapter must not invent skills missing from the source |
| Missing arrays | null distinguishes unknown | [] also means not extracted | Agree missing-vs-confirmed-empty semantics before ineligibility decisions |
| Opportunity description | string required | string or null | Normalize null only for ranking text, not as a source fact |
| Resume response | profile_draft/evidence/warnings | extracted | D/C must agree wrapper and where evidence/review state is retained |
| Match response | eligibility_status/match_score/match_reasons | eligibility/relevance_score/explanation | Adapter mapping after status enum is agreed |
| Match request | local demo accepts profile plus IDs | profile comes from authenticated session | D resolves ownership; never trust client user_id |
| Positive eligibility | trusted internal completeness review | all listed hard checks pass | Agree completeness signal; empty/missing requirements must not imply eligibility |
| Upload limit | local demo 2 MB | draft 5 MB | Keep local limits documented; D confirms production 5 MB and resource limits |

The original planning document and new draft disagree on the pending enum.
Do not silently change either shared schema or other members' code. The current
B internal prototype keeps the original enum until the team confirms a resolution.

## Exact handoff requests

### Member A

Provide 3-5 reviewed public opportunity records with source URLs and qualification
quotes, not student information. Include one time requirement, one skill/course
requirement and one missing/ambiguous requirement. Confirm whether output follows
the old string format or new structured format. Let D assign database UUIDs.

### Member D

Confirm the canonical pending enum and profile/API schema revision. Provide the
development base URL or branch with authenticated profile, resume and match routes,
a documented test sign-in flow, and the chosen Python invocation/hosting approach.
Confirm whether B supplies adapters only or is explicitly assigned route changes.
Agree how requirement completeness and student-confirmed fields are represented.
Never send production credentials or real user records as fixtures.

### Member C

Confirm the extracted-profile wrapper and matching-result fields. Provide the
frontend branch or test page for upload consent, editable review, confirmation and
unknown-state rendering. Confirm all product copy is English.

## Can proceed now versus blocked

Resume-side mapping is also available as `adapt_resume_draft(parsed)` in the
same adapter module. It returns `extracted` plus `review_metadata`, preserving
source evidence, warnings, original experience details and unmapped fields.
Unknown arrays are omitted, not converted to confirmed empty values. A year
number is mapped only with explicit undergraduate level; employment is not
relabeled as an internship. The metadata wrapper needs C/D approval before use
on a public endpoint. Current validation: 48 offline test methods pass, including
the PDF-to-draft-contract-to-matching path.

An opt-in draft adapter is now implemented in
`services/matching/contract_adapter.py`. `match_contract_draft` requires the caller
to pass `pending_status` explicitly. It accepts D-shaped records and emits a
draft D-shaped result without changing the demo, worker or public routes.
It does not convert skill/course lists into all-of or any-of rules without an
agreement. Empty arrays are unknown unless the trusted caller supplies their
field names through `confirmed_fields`. Trusted review IDs are a separate
internal argument, never a client-provided authorization claim.
Nullable descriptions become empty ranking text only. No graduation day or
experience skill is invented. Current draft relevance scores can be null when
no profile signals exist; D must agree how to represent this rather than using
a misleading zero. Evidence and hard/preferred flags are retained in checks.
The adapter's extra evidence fields and null-score behavior need team approval.

Validation: 44 non-network tests passed, including seven adapter tests. This is
synthetic contract validation, not a live backend integration. No shared files
or other members' modules were changed.

B's standalone parser, rules, ranking, worker and synthetic flow tests are usable.
Production adapters must wait for the conflicting public semantics to be resolved.
No private student data is required. No database access or new account permission
is needed to review JSON samples. Real deployment tests need D's test environment.
