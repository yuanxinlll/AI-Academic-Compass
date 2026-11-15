# Category discovery handoff to B/D

Checked 2026-11-14 Pacific / 2026-11-15 UTC. Internal collector metadata and public
opportunity records only; no private student data or credentials.

## Implemented and tested

source_registry.json is the maintained source inventory. registry.py uses
independent discovery budgets for research, internship, event, competition,
program and course, records parent URLs and category provenance, and generates
legacy flat input lists. Directory pages are not opportunities. Stages distinguish
candidates, collected pages and source review; none grants verified status.

The refined real run fetched 17 pages across six groups with no errors. It made
six upsert operations, including the same opportunity reached through different
groups; these are not six new rows. Three new records were inserted across the
initial and refined tests. Two repeated visits updated rather than duplicated them.
Source/record details and current API IDs are in
[discovery-records-2026-11-14.json](discovery-records-2026-11-14.json).

## New rows for B's inspection

| Opportunity | Category / state | Review context |
| --- | --- | --- |
| AIP Enrollment Workshop | event / needs_verification | Calendar source explicitly lists November 30, 2026 and Audience: All students. Enrollment support, not an internship placement. Concrete RSVP destination still needs review; event date is not an application deadline. |
| UC Center Sacramento | program / expired | UCSD source lists historical 2025/2026 cycle dates. Keep out of active recommendations; follow current official center details before considering a new cycle. GPA is preferred, not a hard failure. |
| Basement Affiliate Student Organization Program | program / needs_verification | Requirements apply to a registered student organization, not an individual applicant. B must keep organization-level criteria unresolved for an individual student rather than assuming they qualify. |

The last public readback has UCSD-hosted category counts:
- research: 19
- internship: 0
- event: 1
- competition: 0
- program: 9
- course: 1

These counts include expired rows and exclude non-UCSD-hosted seed/test rows.
They measure our collected sources, not the university's complete opportunity supply.

## Coverage and coordination still needed

- Internship/competition directories currently led to programs or off-domain
  destinations. No standalone internship or competition was established by this
  run; do not relabel programs to fill those categories.
- The learning directory led to a Carpentries page containing a past workshop
  and a separate instructor-training opportunity. They were not merged or saved
  under one source URL. Separate canonical detail URLs or a D-approved identity
  decision are needed. The existing course row predates this test.
- External candidates are a deduplicated review queue, not verified openings;
  many are generic tools, portals or registration providers. Prioritize and
  approve specific primary destinations before expanding the current UCSD-host
  fetch allowlist. Do not treat the queue size as opportunity count.
- D: agree multi-offering identity, failed/empty-attempt logging, and deployed
  scheduling with durable state and budgets. Current API auth/persistence works;
  no schema/route changes were made by A.
- B: consume content-based categories and separate opportunity verification from
  student eligibility. These new rows have not passed human completeness review.
- A: strengthen seed selection and reviewed external destinations for missing
  categories, review application links/requirements, and build a human-labeled
  extraction benchmark. The live run is integration evidence, not accuracy scoring.

Run: python -m collector.registry --pages-per-group 3 --ingest .
Offline tests: python -B -m unittest discover -s collector/tests -q .
The local --interval loop and registry CLI do not establish deployed automation.
