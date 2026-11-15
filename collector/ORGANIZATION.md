# How collection data is organized

> Current integration and coordination: [collection audit](PROJECT_AUDIT.md).
> Direct database writes below describe historical integration. The --ingest
> admin-API transport is now implemented and live-tested; see collector README
> and VALIDATION.md. These historical review notes do not grant admin approval.


Recorded 2026-11-14. This documents existing organization and the newly searched
candidate links; it does not change D's schema or approve new opportunities.

## Current discovery organization

[source_registry.json](source_registry.json) now owns source metadata and
provenance. The three URL-only input lists are generated views. Use
python -m collector.registry for category-budgeted discovery and monitoring.
See [current discovery handoff](reviews/DISCOVERY_HANDOFF.md) for results and gaps.
The nine-link table below is the earlier search snapshot, not the complete current
candidate queue. Backend tables and public opportunity fields are unchanged.

## Earlier search queue

[candidate_sources.json](candidate_sources.json) is now a generated URL-only collection input. The table describes its earlier nine-link snapshot.
The table below adds review context. These nine links are candidates, not newly
inserted or admin-verified Neon records. Closed or stale pages can be monitored
for a future cycle but must not be advertised as currently open.

| Candidate | Suggested category | Review note |
| --- | --- | --- |
| [Neural Crossroads Laboratory research assistants](https://neuralcrossroads.ucsd.edu/opportunities/) | research | Standing research-assistant invitation with direct application form and CV route. Full qualification/application-form review still needed. |
| [Moores Cancer Center undergraduate internships](https://moorescancercenter.ucsd.edu/education/training-programs/undergraduate.html) | internship | 2027 summer program lists April 1 application deadline; multiple programs share the page. Find individual canonical detail pages or agree the data model before splitting roles. |
| [Academic Internship Program](https://experientiallearning.ucsd.edu/aip/index.html) | program | Academic-credit pathway with alternative lower/upper-division enrollment criteria, not a specific paid job. Review the selected course route. |
| [UCDC](https://aip.ucsd.edu/whatwedo/ucdc/index.html) | program | Summer 2027 applications are described as automatically waitlisted. Preserve waitlist context; do not imply an available placement. |
| [MPL Summer Internship Program](https://mpl.ucsd.edu/internships/) | internship | Page says applications open late November 2026 but eligibility refers to a June 2026 start. Cycle dates conflict; do not invent a 2027 deadline. |
| [Scripps JT-SURF](https://scripps.ucsd.edu/undergrad/surf) | program | Undergraduate earth/ocean/atmospheric-science research fellowship. Landing page still links 2026 projects; current application details require checking. |
| [UC Center Sacramento](https://aip.ucsd.edu/whatwedo/uccs/index.html) | program | Policy research/internship program; UCSD page lists old Winter/Spring 2026 dates. Follow the official center link for a current cycle. |
| [Poseidon Fellows](https://ccgt.ucsd.edu/initiatives/wavemaker-lab/poseidon-fellows.html) | program | Official UCSD introduction links the program website. That website gives a November 12, 2026 deadline, already past on November 14. Future-cycle monitoring, not a new open listing. [Program site](https://www.poseidonfellows.com/) |
| [Under Armour 2027 Finance and Accounting internship (UCSD Rady listing)](https://career.rady.ucsd.edu/jobs/under-armour-2027-summer-internship-finance-and-accounting/) | internship | External-employer internship listed by UCSD Rady. Confirm the employer posting, authorization criteria and current vacancy; do not label the employer as UCSD. |

## Current branch files

| Location | Purpose |
| --- | --- |
| sources.json | Original small seed list: FMP and the academic-year directory. |
| candidate_sources.json | Newly discovered links waiting for full extraction/review. |
| reviewed_sources.json | The 24 source pages from the expanded collection; inclusion does not mean admin-approved verified status. |
| reviews/ucsd-opportunities-2026-11-14.json | Dated public-record snapshot, database IDs, source evidence, review-completeness notes and excluded sources. |
| reviews/B_HANDOFF.md | Representative eligibility cases and nine review candidates for B/D. |
| output/ | Ignored runtime state, source text, hashes, exports and reports. This is local working data, not the live backend. |
| main.py, text.py, validation.py, pipeline.py | Fetching, extraction, cleaning, evidence validation, discovery, monitoring and deduplication. |
| storage.py | Collector adapter that writes into D's existing tables. |
| approve_reviews.py | Checks reviewed records against the live feed and uses D's authenticated admin endpoint when explicitly applied. |

We classify records with fields rather than copying them into one file or
database per category. Candidate, collected, source-reviewed and admin-approved
are different stages. A flat source list alone cannot communicate all of them;
the review manifest and this queue supply the context.

## Backend organization

D owns the PostgreSQL schema. A's script writes three existing public-data tables:

| Table | Meaning |
| --- | --- |
| sources | A monitored source URL, source_id, university, page type and last-check time. |
| opportunities | A structured opportunity with category, lab/department, description, eligibility, deadline, review status and original URL. |
| collection_logs | A collection attempt's source_id, time, number of records and errors. |

opportunities.source_id and collection_logs.source_id reference sources.
UUIDs are generated by the database. Repeated collection upserts by source_url
and preserves the opportunity ID and first_collected_at.

All opportunity categories share the opportunities table. category is one of
research, internship, event, competition, program or course. organization names
the lab/department/employer; university identifies the campus. status is the
record's verification/expiry state, not a student's eligibility result.
eligibility is structured JSON for B's assessment.

D's APIs read these fields for search, filtering, sorting and frontend delivery.
C owns how groups and filters are presented to students; B owns personal
eligibility and relevance ranking.

Read-only Neon observation for real UCSD records at this check:
- 19 research records.
- 7 program records, including the expired CAMP record.
- 1 course record.

The current adapter creates sources with source_type=listing for every page.
The database currently contains 28 listing sources and 1 lab_page source.
Although D's schema supports lab_page, department, calendar, listing and other,
our adapter is not yet assigning these distinctions automatically. Suggested
page types for new candidates should be reviewed by A before ingestion.

## Ownership: A versus D

| Work | Owner |
| --- | --- |
| Find sources, maintain the URL queue and decide which pages are useful | A |
| Extract, clean, categorize and deduplicate records; retain evidence | A |
| Assign existing category/source-type values from source content | A |
| Track uncertainty, changes, closed records and review readiness | A |
| Define tables, columns, indexes, constraints, IDs and relationships | D |
| Maintain database credentials/roles and admin approval endpoints | D |
| Build API filters, pagination, authentication and deployment | D |
| Agree changes to shared field meanings, enums or identity rules | A + D + affected teammates |

Organizing the collected information is part of A's job. Designing and operating
the backend that stores and serves it is D's job. A should not wait for D to sort
raw links into useful data, and should not independently change D's schema.

## Data-model issue to coordinate

The current contract makes opportunities.source_url unique. Some pages list
several independent internships or roles (for example Moores Cancer Center).
A must find individual canonical detail pages where available and avoid merging
unrelated requirements. If distinct opportunities truly share a single source
URL, A and D must agree an identity/schema change before storing multiple rows.
Do not invent fragment URLs merely to bypass the uniqueness constraint.
