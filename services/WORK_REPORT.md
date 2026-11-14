# Member B Work Report

Project: Academic Compass | Role: AI and Personalization | Date: 2026-11-14

## Delivery status

The B module is implemented, tested and deployed as a stateless FastAPI service.
Final application acceptance is not complete: D's public matching route still
returns AI_SERVICE_NOT_CONFIGURED, and the public dataset has no verified real
opportunities. This report supersedes earlier draft-status notes.

## Completed implementation

| Area | Delivered behavior |
| --- | --- |
| PDF processing | Text extraction, malformed/encrypted/textless file errors, 4 MiB and 10-page limits |
| Gemini | REST adapter, explicit upload opt-in, structured output and evidence validation, sanitized provider errors, 30-second timeout |
| Draft review | Local English upload/edit/confirm demo; conflict-preserving profile merge; production output is extracted partial profile |
| Qualification | Structured conditions; undergraduate/year/time/single-skill/course/major rules; unknown requirements remain pending |
| Contract v1.1 | needs_confirmation for personal qualification; verified source gate; preferred conditions do not disqualify; student empty arrays mean unknown |
| Ranking | Deterministic lexical interests/skills/category relevance; null for unavailable signals; stable ID ties; all input opportunities returned |
| Integration | Authenticated /internal/match and /internal/resume/parse; no database or profile persistence |
| Delivery | Vercel configuration, D handoff template, offline and live-check scripts, v1.1 JSON fixtures |

## Deployment

- Production service: https://academic-compass-ai.vercel.app
- Team/project: hhh-967a / academic-compass-ai
- Root Directory: services; entrypoint main:app; branch feature/personalization
- Python 3.12 confirmed in Vercel build logs; production Ready status observed.
- Latest owner-triggered token-update deployment observed: GmtM1TxRfg5ks5VvodXuceqngJzN.
- Request without a token returns the application's UNAUTHORIZED JSON.
- Secret names/type/scope checked, never values. The owner manages secret rotation.

The first cloud invocation failed because the entrypoint-only pyproject.toml
overrode requirements discovery. Explicit project dependencies fixed this.
The initial commit-author mapping failure was resolved for new commits using
the owner's supplied repository-local identity; old history was not rewritten.

## Verification evidence

- 62 offline test methods passed again after merging main (through e39c11a).
- Tests cover ASGI endpoints, token gates, upload size/type errors, real synthetic
  PDF extraction, mocked Gemini, rules, ranking, merging and subprocess calls.
- Main merge had one .gitignore conflict, resolved with main's complete rules
  after explicit owner confirmation.
- Public GET /api/opportunities: HTTP 200, 7 objects accepted by B's adapter.
- All seven public source hosts were example.com; zero opportunities were verified.
- Public POST /api/profile: HTTP 200 for isolated fictional user b-integration-20261114.
- Public POST /api/match: HTTP 503, AI_SERVICE_NOT_CONFIGURED, on the latest check.
- Owner reported PASS from the live Gemini fictional-text connection script.
- Live full PDF -> Gemini -> public confirmation -> ranking acceptance is pending.

Node/npm are absent from this execution environment. npm install could not run;
Next.js build success is not claimed. B did not edit D's Next.js implementation.

## Run and review

From the repository root:

```bash
# All offline checks, no ports or real credentials
.venv/bin/python -B services/matching/run_checks.py

# Final v1.1 matching output with fictional data, no network
.venv/bin/python -B services/matching/demo_v11.py

# Public D -> B acceptance with one isolated fictional profile
.venv/bin/python -B services/ai/check_public_integration.py --save-fictional-profile

# Private token smoke check; the owner enters the secret locally
.venv/bin/python -B services/ai/check_deployment.py
```

The JSON fixtures are examples, not real opportunities or accuracy benchmarks.
The legacy local HTML demo remains separate from the production contract.

## Known limitations

- Ranking is lexical, not embedding-based or a validated learned recommendation
  model. Scores are relevance indicators, never acceptance probabilities.
- Arbitrary eligibility prose, GPA/duration/authorization rules and ambiguous
  list semantics are not guessed; they remain needs_confirmation.
- Exact skill/course matching does not establish equivalent coursework or
  synonyms. Real-data precision/recall has not been measured.
- Experience-specific skill ranking exists in the internal prototype, but the
  final profile contract does not supply experience skills; the adapter does not
  invent them. Production experience-semantic ranking is not implemented.
- Resume fallback handles explicit labels only; scanned PDFs require manual input.
- Evidence validation checks excerpt presence, not semantic truth; student review
  remains necessary. Missing/partial fields can remain unextracted.
- D's current demo authentication permits fictional test users only; B does not
  implement production identity, database access or profile ownership.

## Remaining three acceptance items

1. D configures Production AI_SERVICE_URL and the same rotated INTERNAL_TOKEN,
   then redeploys Next.js. The current 503 occurs before B is called, so token
   equality is not yet established by the public integration check.
2. Rerun cross-service matching and PDF checks, then the opted-in Gemini and C
   review flow. Record actual results without sharing secrets.
3. A supplies manually checked real opportunities; validate extraction, rule
   outcomes and student ranking differences with C/D before final sign-off.

B's independent code/deployment deliverables are ready for handoff. The project
and real-data recommendation quality must not be described as fully validated.

## Handoff references

- services/README.md: setup, internal APIs and deployment
- services/D_HANDOFF.md: server-side proxy templates and environment placeholders
- services/INTEGRATION_STATUS.md: latest cross-member blocker
- services/matching/TESTING.md: test scope and historical validation runs
- services/examples/: fictional final-contract request and expected response
