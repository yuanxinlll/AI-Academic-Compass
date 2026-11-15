# Verified UCSD-affiliated student-organization sources

Checked 2026-11-15 UTC (2026-11-14 Pacific). This is source-identity/access review,
not verification of every post or proof of open recruitment. Registered student
organizations are independent entities, not official university units.

## Coverage

- Read all 628 current CSI organization records; 467 contain a social-media field.
- Cross-checked organization website/account links against UCSD Engineering,
  Rady, Biology and Economics organization pages, plus targeted online searches.
- Catalog and complete checked-candidate/access-status list:
  [student_org_sources.json](../student_org_sources.json).
- Fourteen website destinations passed readable-content and affiliation checks.
- Twenty-two Instagram references were located. Public profile/post readability
  was not established with the current fetch methods; no Instagram feed is enabled.
- Remaining social references are an unverified research queue. The directory
  scan is exhaustive for its current 628 records; external-site discovery and
  verification are not exhaustive for all 628 organizations.
- No principal member names, student emails or advisor information were retained.

## Enabled websites

| Organization | Working website | UCSD affiliation evidence |
| --- | --- | --- |
| Association for Computing Machinery (ACM) | [Website](https://acmucsd.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/20905) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Institute of Electrical and Electronics Engineers (IEEE) | [Website](https://ieeeatucsd.org/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21355) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Society of Asian Scientists and Engineers at UC San Diego | [Website](https://saseatucsd.weebly.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/20963) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Society of Civil and Structural Engineers | [Website](https://scse.weebly.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/20947) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Society of Hispanic Professional Engineers | [Website](https://shpe313.wixsite.com/shpe-at-ucsd) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21188) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Undergraduate Bioinformatics Club (UBIC) | [Website](https://bioinformatics.ucsd.edu/undergrad/ubic) | [CSI record](https://studentorg.ucsd.edu/Home/Details/20961) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Video Game Development Club (VGDC) at UC San Diego | [Website](https://www.vgdc.dev/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/20906) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Triton Solar Car | [Website](https://ucsdsolarcar.org/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21494) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |
| Cornerstone Community Consultants at UC San Diego | [Website](https://ucsdcornerstone.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21051) / [Cross-link](https://rady.ucsd.edu/programs/undergraduate/resources/radyvantage.html) |
| Ascend at UC San Diego | [Website](https://ascendatucsandiego.weebly.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21485) / [Cross-link](https://rady.ucsd.edu/programs/undergraduate/resources/radyvantage.html) |
| Beta Alpha Psi | [Website](https://bapatucsdrady.org/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21433) / [Cross-link](https://rady.ucsd.edu/programs/undergraduate/resources/radyvantage.html) |
| Biological Sciences Student Association | [Website](https://www.bssa-at-ucsd.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21017) / [Cross-link](https://biology.ucsd.edu/education/undergrad/student-org/index.html) |
| Design Co | [Website](https://designatucsd.com/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21095) / [Cross-link](https://designatucsd.com/contact) |
| Undergraduate Women in Computing at UC San Diego | [Website](https://wicucsd.vercel.app/) | [CSI record](https://studentorg.ucsd.edu/Home/Details/21366) / [Cross-link](https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate) |

## Access and source policy

The catalog is the authority for external website scopes. The unified source
registry references it and identifies source_family=student_orgs. Only approved
exact hosts/path prefixes are fetchable. A verified site linking another domain
creates a review lead, not automatic trust. Shared-host approvals apply to the
organization's own path, not all of Google Sites, Instagram or another platform.

A working HTTP response alone is insufficient: sign-in pages, parked/offline
sites, unrelated redirects and JS-only responses are not promoted to readable
sources. Broken department links and suspicious redirects remain disabled. Some
real organization sites require browser rendering; do not call them nonexistent.
Instagram account links can be institution-attested while post access is blocked.
An Instagram post extractor and authorship checks are still needed before enabling
feeds; no whole-Instagram allowlist was added.

## Classification and display

The collector reads actual post/detail content and uses the existing six-category
contract. Learning resources map to course. The same organization can publish
an event, internship, competition, course, program or research opportunity. B's
recommendation system ranks those records; no B/C code was changed here.

Generic profile/about pages and unrelated chatter are not opportunities. Each
record retains its own URL, eligibility quotations, date evidence and uncertainty.
Source affiliation never marks a record verified or a student eligible. Failed
or empty pages produce no student-facing opportunity; diagnostics remain local.
The frontend has not been changed to display a raw social-media feed.

Follow relevant child pages with visited-URL tracking and bounded depth/page
budgets. One directory per category rotates between runs so roots do not consume
the entire budget. When a terminal URL still combines distinct offerings, do not
merge their eligibility or invent fragment identifiers.

## Live validation

A four-page IEEE crawl from its verified website reached three project pages.
The refined run saved one new program and updated the expired competition first
inserted during the initial run, with no errors. Classification came from content:
Quarterly Project was a program; TritonBots RoboCup SSL was a competition whose
source-supported deadline is past. Neither is human-approved. Initial evidence
validation failure withheld a record; a subsequent validated extraction saved it.

Evidence is in ignored output/student-org-live/state.json and report.json, with
initial-report.json retained. Public readback is recorded in
[student-org-opportunities-2026-11-14.json](student-org-opportunities-2026-11-14.json).

## Commands and team coordination

```powershell
# Public directory scan; no provider keys, no database access.
python -m collector.student_orgs --limit 628

# Recheck curated directory/search leads; refresh scoped source approvals.
python -m collector.org_verification

# Recheck/discover a selected organization's posts/detail pages.
python -m collector.registry --source-family student_orgs --organization IEEE --groups competition --pages-per-group 4 --max-depth 3 --ingest
```

Collection uses configured Bright Data/Gemini accounts; --ingest also needs
ADMIN_TOKEN. No DATABASE_URL is needed. D owns deployment of the agreed daily
08:00 America/Los_Angeles schedule (including daylight saving time); no deployed
scheduler is claimed. D/B/C coordination is needed for Instagram post ingestion
or new source-affiliation UI/API metadata. No shared schema or category was changed.
