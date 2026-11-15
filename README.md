# Academic Compass

**Discover Opportunities. Navigate Your Future.**

Academic Compass helps students discover academic and career-development
opportunities from public sources, understand their requirements, and prioritize
them using their own background and interests. Built for SanD Hacks 2026, the
project starts with UC San Diego undergraduates and is designed for future
expansion to other universities.

**Current stage:** a working collection/backend/AI integration in active
development. The full student-facing experience and final acceptance are still
being integrated. This README reflects progress as of November 14, 2026.

## Why we are building it

Research openings, internships and academic programs are scattered across lab
pages, department websites and event calendars. Requirements and deadlines can
be incomplete, making it difficult to find relevant opportunities and understand
what needs confirmation.

Our priority is **automated collection of real opportunities**. Personalization
helps students navigate that information; it does not replace source verification
or decide which opportunities students are allowed to see.

The platform covers six categories:

| Category | Examples |
| --- | --- |
| Research | Undergraduate research and lab opportunities |
| Internship | Industry, research and campus internships |
| Event | Seminars, workshops and conferences |
| Competition | Hackathons and academic challenges |
| Program | Fellowships and summer research programs |
| Course | Courses, training and learning resources |

## Intended student experience

1. Enter academic background, interests, skills and opportunity preferences.
2. Optionally upload a text-based PDF resume; manual onboarding remains available.
3. Review and correct extracted information before saving a profile.
4. Browse opportunities with qualification checks, relevance scores and source links.
5. Search, filter, bookmark and track applications through the student interface.

This is the intended end-to-end product flow. Individual services are implemented;
the complete frontend flow is not yet accepted as finished.

## Progress

| Area | Current evidence and status |
| --- | --- |
| Collection | The collection branch implements bounded UCSD discovery, monitoring, Bright Data retrieval, Gemini extraction, validation and Neon upserts. Its validation report records three real program sources saved/read back from Neon. |
| Database and backend | Neon schema and public opportunity, profile, bookmark, matching, resume-proxy and admin-ingestion routes are present in backend/main work. |
| AI service | Stateless FastAPI service deployed independently on Vercel, with internal-token authentication and the v1.1 adapter. |
| Cross-service integration | Independently tested public opportunity listing, fictional profile save, matching and local-mode PDF parsing with HTTP 200 responses. |
| Automated B checks | 62 offline tests passed, covering qualification, ranking, PDF processing, mocked Gemini, adapters and ASGI endpoints. |
| Frontend | Next.js skeleton exists. Production onboarding, dashboard and complete student-review flow remain integration work. |
| Final acceptance | Live verified-to-eligible acceptance and opted-in PDF/Gemini/student-confirmation flow are pending. |

Some modules remain on separate feature branches. A module's completion does not
mean it has been merged into `main` or validated through the final UI. Collection
results above are documented in [A's validation report](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/collection/collector/VALIDATION.md),
not a project-wide extraction accuracy benchmark.

### Available endpoints

- Public opportunity API: [GET /api/opportunities](https://ai-academic-compass.vercel.app/api/opportunities)
- Example filter: [research opportunities](https://ai-academic-compass.vercel.app/api/opportunities?category=research)
- Internal AI origin: `https://academic-compass-ai.vercel.app`

The AI origin is an authenticated backend service, not a student-facing website.
The public dataset may contain both demonstration and collected records; inspect
each record's source and verification state before interpreting it as a live opening.

## Architecture

```text
Public UCSD sources
    -> A: Python collector + Bright Data + Gemini
    -> Neon PostgreSQL

C: Next.js student interface
    -> D: Next.js /api/* (identity, validation, database access)
        -> Neon PostgreSQL
        -> B: FastAPI /internal/* (resume parsing, qualification, ranking)
```

The Python AI service does not connect to the database or persist resumes and
profiles. Only D's server forwards the internal token; the browser does not receive it.

| Component | Technology |
| --- | --- |
| Web application | Next.js, React, TypeScript, Tailwind CSS |
| Public API | Next.js Route Handlers |
| Collection | Python, Bright Data, Gemini |
| AI processing | Python, FastAPI, pypdf, Gemini |
| Storage | Neon PostgreSQL |
| Hosting | Vercel; web and AI services are separate projects |

## Data and qualification principles

The authoritative shared definitions are in [docs/contracts.md](docs/contracts.md).

- Opportunity `status`: `verified`, `needs_verification` or `expired`.
- Student qualification `eligibility.status`: `eligible`, `ineligible` or
  `needs_confirmation`. This is a separate, computed result.
- A clear hard-requirement failure produces `ineligible`. Otherwise the
  opportunity must be `verified`, with no unknown hard conditions, to produce
  `eligible`. Preferred qualifications never disqualify a student.
- Student arrays use `[]` for unprovided information, not proof of absence.
  Missing scalar values use `null`. Unknown requirements are not guessed.
- Relevance scores indicate lexical relatedness, not acceptance probability.
  A score can be `null` when no usable profile signals exist. Low-score records
  remain available; matching does not silently hide them.
- Source links and raw requirement text are retained. Dates and sensitive
  identity/work-authorization information must not be invented.

## Repository and ownership

```text
app/, components/           C: student-facing pages and components
app/api/, lib/database/     D: public routes and database integration
collector/                 A: collection, validation and persistence
services/main.py           B: production FastAPI entrypoint
services/ai/               B: resume parsing and Gemini adapter
services/matching/         B: rules, ranking, adapters and local demo
services/examples/         B: fictional v1.1 request/response examples
docs/contracts.md          Shared data and API agreement
```

Work on separate branches and integrate through pull requests. Do not change
another member's module, public field names or database schema without agreement.
The collector implementation is currently available on
[`feature/collection`](https://github.com/yuanxinlll/AI-Academic-Compass/tree/feature/collection).

## Local setup

### Web and public API

Use a Node.js version supported by the repository's Next.js release, and npm.

```bash
git clone https://github.com/yuanxinlll/AI-Academic-Compass.git
cd AI-Academic-Compass
# Check out the team's current integration branch before installing.
npm install
cp .env.example .env.local
npm run dev
```

Fill the local environment file using credentials provided privately by the
appropriate owner. Database setup/migrations belong to D; do not run destructive
schema changes as part of onboarding. Use fictional student data while demo
authentication is enabled.

### Python AI service

These commands require the branch containing `services/`. Use Python 3.11 or
later; Vercel is configured for Python 3.12.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r services/requirements-dev.txt
# Export INTERNAL_TOKEN; optionally GEMINI_API_KEY and GEMINI_MODEL.
.venv/bin/python -m uvicorn main:app --app-dir services --host 127.0.0.1 --port 8000
```

On Windows, use the virtual environment's `Scripts/python.exe` equivalent.
See [services/README.md](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/README.md) for the authenticated API and Vercel setup.

### Collection

Check out the collection/integration branch that contains the implementation,
then follow [the collector setup guide](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/collection/collector/README.md).
Collection uses provider quota. Database mode requires collector-authorized
credentials; it never needs access to private student tables.

## Environment variables

| Variable | Where it is used |
| --- | --- |
| `DATABASE_URL` | D's backend and A's authorized collector; not B's AI service |
| `BRIGHTDATA_API_KEY` | Collector; see its guide for additional provider settings |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Collector and AI service, as configured by each owner |
| `AI_SERVICE_URL` | Next.js server; points to the AI service origin |
| `INTERNAL_TOKEN` | Same private value in Next.js and AI service deployments |
| `ADMIN_TOKEN` | D's administrative ingestion/review operations |
| `AUTH_SECRET` | Reserved for the team's authentication setup |

Never commit real values, use `NEXT_PUBLIC_` for secrets, or share credentials in
issues and screenshots. Environment changes require the affected deployment to
be rebuilt/redeployed. The current demo-user authentication is suitable only for
fictional data and is not production identity protection.

## Tests and demonstrations

From the repository root with Python development dependencies installed:

```bash
# B's offline checks: no real keys, ports or provider calls
.venv/bin/python -B services/matching/run_checks.py

# Final v1.1 output using fictional records, no network
.venv/bin/python -B services/matching/demo_v11.py

# Optional local HTML prototype, separate from the production UI
.venv/bin/python -B services/matching/server.py
```

The local HTML prototype is at `http://127.0.0.1:8765` and retains some legacy
internal labels. Use the v1.1 service and fixtures as the integration reference.

[Public integration checks](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/ai/check_public_integration.py) can explicitly
create one isolated fictional demo profile. [Deployment checks](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/ai/check_deployment.py)
accept the internal token through a private local prompt. Neither requires sharing
credentials in chat. Live opted-in Gemini checks consume provider quota.

## Remaining work and limits

- Complete and verify C's onboarding, editable profile review and dashboard flow.
- Validate reviewed real opportunities through the live `verified -> eligible`
  path, including missing information and explicit failures.
- Validate `use_ai=true` from PDF upload through Gemini, student confirmation,
  persistence and renewed matching.
- Expand beyond the small reviewed source sample and measure extraction and
  qualification quality; the planned 20-30 listing study is not complete.
- Ranking is a deterministic keyword baseline. Complex qualification rules and
  ambiguous conditions stay pending instead of being treated as known facts.
- Scanned PDFs are not supported by the current text extractor.

UCLA expansion, cross-university information-transparency analysis, calendar
sync, reminders and a planning assistant are future extensions. The Data for Good
direction concerns the transparency of collected information; collected record
counts must not be treated as a ranking of universities' total resources.

## Acknowledgments

The ocean UI takes visual inspiration from
[jiezi1234/character-ocean](https://github.com/jiezi1234/character-ocean),
particularly its braille-style fish, translucent panels, and light/dark palettes.
That project credits [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks)
as its animation upstream. Our background uses a custom React/Canvas implementation.

Geist and Geist Mono are provided through `next/font/google` and licensed under
SIL OFL 1.1: [Geist](https://github.com/google/fonts/blob/main/ofl/geist/OFL.txt)
and [Geist Mono](https://github.com/google/fonts/blob/main/ofl/geistmono/OFL.txt).

## Further reading

- [Project concept and four-person development plan](https://docs.google.com/document/d/14lm-ddJUyXBM2freSapi1f9j5PgR0-qeHOPcZxY1GLQ/edit)
- [Shared contracts](docs/contracts.md)
- [B's work report](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/WORK_REPORT.md)
- [D integration handoff](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/D_HANDOFF.md)
- [AI integration status](https://github.com/yuanxinlll/AI-Academic-Compass/blob/feature/personalization/services/INTEGRATION_STATUS.md)
