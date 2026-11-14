> Final v1.1 service: see ../README.md. This document describes the legacy local demo.

# Matching prototype

Run from the repository root:

```bash
python3 -B services/matching/demo.py
python3 -B -m unittest discover -s services/matching -p 'test_*.py' -v
```

The matching engine needs no dependencies. The PDF upload server requires pypdf.
No credentials, database or external API access are required.

## Interactive demo and local APIs

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r services/ai/requirements.txt
.venv/bin/python -B services/matching/server.py
```

Open http://127.0.0.1:8765. Select a fictional student and change availability.
The page calls the real local matching endpoint and shows its raw JSON response.
This loopback-only server is for development; it does not replace member D's
Next.js routes and must not be exposed as a production service.

- `GET /api/opportunities`: fictional opportunity records.
- `POST /api/match`: accepts `profile` and `opportunity_ids`.
- `POST /api/profile/merge`: accepts `confirmed` and `draft`; returns a proposed
  merge and conflicts. No data is persisted or automatically confirmed.
- `POST /api/resume/parse`: multipart `file` upload; returns an unconfirmed draft.

PDF extraction supports text-based PDFs up to 4 MB and 10 pages in this demo.
These local limits are not the production upload contract. Encrypted, invalid,
and textless PDFs receive explicit errors. No file is saved.
The fallback extracts only explicit `University:`, `Major:`, `Education level:`,
`Skills:`, `Interests:` and `Completed courses:` labels. It is not semantic AI
parsing. Optional Gemini configuration is documented in `../ai/README.md`.
Other fields require manual review/input in local mode.
Review and edit the draft JSON, then confirm it for the browser session to match.
The page does not persist profiles, PDFs or raw text.
The prototype runs on the currently available Python 3.9; the agreed production
target remains Python 3.11 or later and has not been verified here.

`match(profile, opportunities)` returns all opportunities ranked by lexical
relevance. Interests and skills each carry weight 35; category preference carries
weight 20; explicit experience skills carry weight 10. Only dimensions with supplied, nonempty values participate. Scores
are relevance indicators, not acceptance probabilities. Stable ties use IDs.

Eligibility recognizes narrow English patterns for undergraduate status, weekly
hours, explicit single skills, completed courses and minimum academic year. Unrecognized requirements remain unknown. Explicit failures produce
`ineligible`. Otherwise the result remains `needs_verification` unless a trusted internal
caller supplies reviewed requirement IDs and every explicit condition passes.
The demo and worker do not accept that review flag from student requests;
production review ownership and persistence still require team agreement. Raw requirements and decisions are preserved.

This is an internal prototype, not an approved public API contract. It does not
implement profile persistence, authentication, semantic
matching, deadline ranking, or deployment. All demo records are fictional.
