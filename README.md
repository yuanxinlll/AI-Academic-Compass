<p align="center"><img src="app/icon.png" width="96" alt="Academic Compass icon"></p>

# Academic Compass

**Discover opportunities. Navigate your future.**

Academic Compass collects research positions, internships, programs and events from
public UC San Diego pages and puts them in one place. For each listing it shows the
requirements **quoted word for word from the source page**, and tells a signed-in
student which ones they meet, which they don't, and which they need to confirm.

Built in a weekend for **SanD Hacks 2026**.

**Live site:** https://ai-academic-compass.vercel.app

## Try it

1. Open the live site and click **Sign in**.
2. Pick a demo student. All three are fictional and already have a profile:
   - **Maya Chen** · CS sophomore · machine learning, HCI
   - **Jordan Rivera** · Biology junior · neuroscience research
   - **Priya Patel** · Cognitive Science transfer junior · data for social good
3. Read the one-page disclaimer, then browse **Picked for you** or **Explore**.
4. Open any card to see each requirement, the quote it came from, and whether you meet it.
5. Sign in as **Reviewer** to see the review queue. Verifying a listing is what lets a
   student's label turn into a starred **Eligible**.

## Why

Openings are scattered across lab pages, department sites and calendars. Requirements
are often buried in a paragraph, and students (especially transfer and first-gen
students) skip opportunities they actually qualify for, or apply to ones they can't.

## How it works

```text
Public UCSD pages
  → Collector (Python, Bright Data, Gemini): find pages, extract listings + exact quotes
  → Neon Postgres  (every listing starts as "needs verification")
  → Reviewer checks the listing against its source  →  "verified"

Student (Next.js)
  → /api/*  (Next.js route handlers: login, data, validation)
      → Neon Postgres
      → Matching service (FastAPI): fixed eligibility rules
      → Relevance v2 (TypeScript): six explainable signals
```

### What AI does — and doesn't

| AI does | AI does not |
|---|---|
| Read source pages and pull out listings and requirement quotes | Decide whether a student is eligible |
| Parse an optional resume into a draft profile the student confirms | Invent requirements, dates or values it can't find |
| | Rank students or predict acceptance |

**Eligibility** comes from fixed rules comparing the quoted requirements to the profile.
A listing can only be **Eligible** once a person has verified it; before that the best a
student can see is **Likely eligible · Listing not yet verified**.

**Relevance** (`rel-v2.0`) is a separate score from six signals, each shown with a
one-line reason: topic match 35, skills 25, major 15, category 10, time fit 10,
preferred qualifications 5. A signal with no data is skipped, not scored as zero.
Details in [`lib/relevance.ts`](lib/relevance.ts) and [contracts §9.3](docs/contracts.md).

### Labels students see

| Label | Meaning |
|---|---|
| ★ **Eligible** | Verified listing, you meet every requirement |
| **Likely eligible** · Listing not yet verified | You meet everything we found, but nobody has checked the listing yet |
| **Check requirements** · Confirm N requirements | Some requirements need information we don't have |
| **Likely not eligible** · Listing not yet verified | You miss a requirement on an unverified listing |
| **Not eligible** | Verified listing, you miss a hard requirement |

Signed-out visitors see listings without any labels.

## Tech

Next.js 16 · React · TypeScript · Tailwind · Neon Postgres · Python · FastAPI ·
Bright Data · Gemini · Vercel

## Run locally

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL, AUTH_SECRET, AI_SERVICE_URL, INTERNAL_TOKEN, ADMIN_TOKEN
node scripts/migrate.mjs lib/database/migrations/002_demo_accounts.sql
npm run dev                     # http://localhost:3000
```

- Data cleanup (dry run by default): `node scripts/cleanup-data.mjs [--apply]`
- Matching service: see [services/README.md](services/README.md)
- Collector: see [collector/README.md](collector/README.md)
- API and data contract: [docs/contracts.md](docs/contracts.md)

## Repository

```text
app/                  Pages (home, search, detail, login, disclaimer, profile, review queue)
app/api/              Public API (auth, opportunities, match, bookmarks, admin, stats)
lib/                  Auth, validation, relevance v2, database access, browser client
lib/database/         Schema and migrations
collector/            Source discovery, extraction and ingestion (Python)
services/             Resume parsing and eligibility rules (FastAPI)
docs/contracts.md     Shared data and API agreement
```

## Limits

- Demo accounts only; there is no real sign-up yet. Store only fictional data.
- Coverage is a set of UCSD sources, not every opportunity on campus.
- Extraction can miss or misread requirements. That is why listings stay
  "not yet verified" until a person checks them, and why every requirement links
  back to its source.

## Credits

Ocean background visual idea inspired by
[jiezi1234/character-ocean](https://github.com/jiezi1234/character-ocean); the fish
shapes and animation in this project are an independent implementation.
