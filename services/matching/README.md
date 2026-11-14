# Matching prototype

Run from the repository root:

```bash
python3 -B services/matching/demo.py
python3 -B -m unittest discover -s services/matching -p 'test_*.py' -v
```

No dependencies, credentials, database, or network access are required.

## Interactive demo and local APIs

```bash
python3 -B services/matching/server.py
```

Open http://127.0.0.1:8765. Select a fictional student and change availability.
The page calls the real local matching endpoint and shows its raw JSON response.
This loopback-only server is for development; it does not replace member D's
Next.js routes and must not be exposed as a production service.

- `GET /api/opportunities`: fictional opportunity records.
- `POST /api/match`: accepts `profile` and `opportunity_ids`.
- `POST /api/profile/merge`: accepts `confirmed` and `draft`; returns a proposed
  merge and conflicts. No data is persisted or automatically confirmed.
- `POST /api/resume/parse`: explicitly returns HTTP 501 until implemented.

No Gemini credentials have been configured. PDF parsing is not implemented.
The prototype runs on the currently available Python 3.9; the agreed production
target remains Python 3.11 or later and has not been verified here.

`match(profile, opportunities)` returns all opportunities ranked by lexical
relevance. Interests and skills each carry weight 40; category preference carries
weight 20. Only dimensions with supplied, nonempty values participate. Scores
are relevance indicators, not acceptance probabilities. Stable ties use IDs.

Eligibility currently recognizes two exact English requirement patterns shown
in the demo. Unrecognized requirements remain unknown. Explicit failures produce
`ineligible`. Otherwise the result remains `needs_verification`, even when all
recognized conditions pass: the shared opportunity schema does not yet establish
that the requirement list is complete. The `eligible` result requires a future
team-approved completeness contract. Raw requirements and decisions are preserved.

This is an internal prototype, not an approved public API contract. It does not
implement PDF parsing, Gemini calls, profile persistence, authentication, semantic
matching, deadline ranking, or deployment. All demo records are fictional.
