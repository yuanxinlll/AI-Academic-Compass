# Member A to B/D: expanded UCSD opportunity data

Reviewed 2026-11-14. Scope: public UCSD opportunities only; no student records,
resumes, credentials, or other members' source files were changed.

## B's requested inputs

Source: [services/ai/CONTRACT_ALIGNMENT.md - Exact handoff requests / Member A](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/ai/CONTRACT_ALIGNMENT.md).

B requested 3-5 source-reviewed examples, qualification quotations, a time
requirement, a skill/course requirement, and missing/ambiguous requirements.
The dataset now provides 24 additional real records with database-generated IDs,
structured v1.1 eligibility objects, source quotes, and individual review notes.

Files:
- [Full records and review decisions](ucsd-opportunities-2026-11-14.json)
- [Monitoring source list](../reviewed_sources.json)

## What was added and checked

- 32 official UCSD pages fetched and inspected.
- 24 additional records inserted into Neon.
- 8 pages excluded: filled/closed recruitment, past-cycle deadlines, or obsolete URL.
  Details are in excluded_sources in the JSON.
- All 24 new rows read back successfully; no duplicate source URLs.
- Persistence recheck inserted zero rows; IDs and first collection timestamps
  stayed stable. One conditional GPA correction updated McNair; the other 23
  repeated saves were duplicates.
- 9 source reviews have complete published requirement lists ready for D approval.
- The remaining 15 new records deliberately keep needs_verification.
- At this check Neon has 27 real UCSD records total: 26 needs_verification and
  one expired. Seed/test rows are additional and were not removed.

Source review was performed by Codex and is identified as such in the manifest.
No human approval or confirmed availability of every standing lab invitation is
claimed. Every record's published scope and uncertainty must remain visible.

## Important: production verified status is pending admin approval

collector/.env currently lacks ADMIN_TOKEN. All 24 additions therefore remain
needs_verification in Neon, including the 9 complete review candidates.
A source-reviewed record is not automatically an eligible student decision.

D should review the nine source links and the requirement-completeness notes,
then approve through the existing authenticated PATCH
/api/admin/opportunities/{id} endpoint. The helper first checks that the public
record still matches the reviewed content and refuses approval if it changed:

```powershell
# Dry run: no credentials needed, no status changes.
collector/.venv/Scripts/python.exe -B -m collector.approve_reviews

# After D supplies the current ADMIN_TOKEN privately in collector/.env,
# and the operator confirms the published-source/requirement review:
collector/.venv/Scripts/python.exe -B -m collector.approve_reviews --apply
```

Never paste ADMIN_TOKEN into chat or commit it. D can instead use its own admin
client to submit {"status":"verified"} for these reviewed records:

| Ready source | Neon opportunity_id |
| --- | --- |
| [Pelham Lab - Undergraduate Research Assistant](https://pelham-lab.ucsd.edu/join-the-team/undergraduates) | fa39cdf0-c11c-4b79-85e6-324c4890e985 |
| [Winkielman Lab - Undergraduate/Volunteer Research Assistant](https://winkielmanlab.ucsd.edu/joinus/) | 824c6a54-15a8-4778-81b3-1c7126d57309 |
| [Eating Disorders Center - Volunteer Research Assistant](https://eatingdisorders.ucsd.edu/node/121) | faf9d67d-0d68-4844-b61b-39baeeed8a71 |
| [Xiong Group - Undergraduate Research Opportunities](https://ultrafast.ucsd.edu/jobs/) | 6049a3cf-8be8-48e9-83a3-a49818cd6e9c |
| [Chu Laboratory - Undergraduate Research Opportunities](https://chulab.ucsd.edu/join/) | 5623a489-7e43-40a7-a9fa-4f8d639accce |
| [Poulikakos Lab - Undergraduate Research Projects](https://poulikakos.ucsd.edu/join-us/) | 3d1e6859-f9fd-450b-8bb3-6a47b34bf874 |
| [Mind and Development Lab - Undergraduate Researcher](https://madlab.ucsd.edu/join) | 1ae64e02-9522-4971-934c-dddf2adc59dc |
| [Griffith Lab - Undergraduate Research Positions](https://griffithlab.ucsd.edu/team) | 52b14e9e-6600-4ffe-b842-174dcdc738b8 |
| [Cognitive Development Lab - COGS 160 Research Practicum](https://cogdevlab.ucsd.edu/contact-us/join-us) | 6cfc5446-775a-48cb-b719-c8271f989ca5 |

## Representative cases for B

| Case | Source | Expected handling |
| --- | --- | --- |
| Minimum time and hard skill | Winkielman Lab | 6 hours/week plus communication skills; prior lab experience is preferred. An explicit time shortfall is ineligible. Adequate time and skills can be eligible only after admin verification. |
| Time plus ongoing participation | Mind and Development Lab | 12 hours/week and 3 quarters, including required meetings. Unsupported duration/meeting checks must stay unresolved. |
| Course/GPA/instructor permission | Cognitive Development Lab, COGS 160 | Two or more upper-division courses in listed subject areas, GPA 3.3, 3-quarter sequence, and instructor permission. No fake mandatory course code was invented. |
| Preferred course | Comparative Cognition Lab | COGS 14A or equivalent is preferred, not mandatory. Recruiting info includes an old meeting date, so record remains needs_verification. |
| Conditional alternatives | PSYC 099/199 common application | 099 and 199 prerequisites are alternative enrollment branches, not conditions every applicant must satisfy simultaneously. |
| Conditional deadline/workload | Biology Summer 2027 research credit | Work hours depend on credit/session choices. June 4 is a recommended submission date; it is not presented as the universal final cutoff. |
| Unknown current vacancy | Winzeler, Biering, Rickard, STRPL | Contact/Handshake or project-specific evidence is still needed; do not advertise a guaranteed open slot. |
| Staged GPA/availability | McNair | GPA attainment can occur later; semester-specific conditions need staged checks. No current numeric GPA cutoff is supplied to force a premature failure. |

Numeric hours/GPA values are numbers when unambiguous; comparisons like >15
or ranges stay unresolved rather than being rounded into an invented threshold.
Course arrays/subject rules are not silently converted to all-of rules.

## B adapter check actually run

B's current engine.py and contract_adapter.py were loaded from
origin/feature/personalization into a temporary directory; B files were not
edited. Four checks using the new Winkielman record passed:

- Actual unverified database record: needs_confirmation.
- A local verified test copy, 12 hours and communication skill: eligible.
- Local verified test copy with only 4 hours: ineligible.
- Local verified test copy with missing skills: needs_confirmation.

The verified copy was an offline fixture, not a production status change.
No fictional student profile was saved to the live API for these checks.

## Monitoring

After admin approval, use the reviewed state from this collection session:

```powershell
collector/.venv/Scripts/python.exe -m collector.main --sources collector/reviewed_sources.json --state collector/output/reviewed-state.json --output collector/output/reviewed-opportunities.json --max-pages 24 --database
```

Add --interval 3600 for repeated monitoring. This can consume provider quota.
Source changes invalidate cached extraction and require renewed review.
The checked-in JSON is a dated handoff snapshot, not a live replacement for Neon.
