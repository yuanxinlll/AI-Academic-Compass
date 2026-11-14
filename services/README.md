# Academic Compass internal AI service

Implements the confirmed `contracts.md` v1.1 from member D's backend branch.
The FastAPI application is `main:app`. No database is used; no uploaded PDF,
profile or extracted text is persisted. `matching/server.py` is a local demo only.

## Install and run

From the repository root, using Python 3.11 or later:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r services/requirements-dev.txt
```

Set `INTERNAL_TOKEN` in the environment without placing the secret in code or
browser JavaScript. Set `GEMINI_API_KEY` and `GEMINI_MODEL` for optional AI parsing.
In Bash, a private token prompt can be used:

```bash
read -r -s -p "Internal token: " INTERNAL_TOKEN
printf '\n'
export INTERNAL_TOKEN
.venv/bin/python -m uvicorn main:app --app-dir services --host 127.0.0.1 --port 8000
```

All requests require `x-internal-token` matching `INTERNAL_TOKEN`. Missing server
configuration returns 503; missing/wrong request tokens return 401. Secrets and
request bodies are not logged by application code. Do not enable body logging
at the proxy. Request authentication happens before request bodies are parsed.

## Internal contracts

### POST /internal/match

JSON body: `{"profile": StudentProfile, "opportunities": Opportunity[]}`.
The caller supplies session-owned profile and database opportunity records.
Returns v1.1 `{"results": [...]}` in relevance order, null scores last.

- Student empty arrays are unknown and do not participate in relevance scoring.
- Explicit hard failures are ineligible even when source data is unverified.
- Otherwise an opportunity not marked verified produces needs_confirmation.
- Verified requirements with unknown hard checks produce needs_confirmation.
- Otherwise eligible, including verified opportunities with no requirements.
- Preferred conditions never determine overall eligibility.
- Unknown/compound conditions retain original text and stay needs_confirmation.
- Array-valued skill/course requirements remain unknown until all-of/any-of
  semantics are established; no rejection is inferred from an ambiguous list.

The service accepts already-resolved opportunities and never queries Neon.
It does not accept a caller override for requirement review; status is the v1.1 gate.

### POST /internal/resume/parse

Multipart field `file`, optional `use_ai=true|false`. Returns exactly
`{"extracted": Partial<StudentProfile>}`. Unknown array fields are omitted,
never returned as null. No user_id is extracted. Student review is required in C
before D saves a profile. PDF bytes stay in memory; no temporary upload is saved.

Maximum PDF size: 4 MiB (4 * 1024 * 1024 bytes). Multipart overhead has a separate
64 KiB allowance. Maximum 10 pages; scanned/image-only PDFs need manual input.
Only explicit opt-in calls Gemini. Local mode extracts explicit labels only.
Provider errors are sanitized and returned without keys or source text.

Errors use `{"error":{"code":"...","message":"..."}}` and HTTP status codes.
No browser CORS policy is enabled: browsers call D's Next.js API, not this service.

## Vercel deployment handoff

1. Create a separate project from the repository and select the integration branch.
2. Set Root Directory to `services` and use the FastAPI framework preset.
3. Entrypoint is explicitly `main:app`; install from `requirements.txt`.
4. `.python-version` selects 3.12, satisfying the team's >=3.11 requirement and
   the currently documented Vercel Python versions. Verify the build log runtime.
5. Set `INTERNAL_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL` in the Python project.
6. In Next.js, set `AI_SERVICE_URL` to the service origin and use the same
   `INTERNAL_TOKEN`; D forwards the header server-side. Never use NEXT_PUBLIC_.
7. Deploy, then test authenticated matching and a fictional PDF before production.
8. If Vercel Deployment Protection is enabled, D must configure server access
   separately. The app token does not bypass platform protection.

Configuration uses a supported main.py entrypoint, maxDuration 60 and Python 3.12.
Deployment is prepared but has not been performed or verified here. Provider
requests time out after 30 seconds. No DATABASE_URL is required by this service.

## Validation

```bash
.venv/bin/python -B services/matching/run_checks.py
```

62 tests currently pass locally (Python 3.9.6 compatibility run), including 14
FastAPI ASGI tests without ports or real keys. Python 3.12 and deployed Vercel
behavior still require validation. Existing HTTP-socket tests are separate.

References:
- https://vercel.com/docs/frameworks/backend/fastapi
- https://vercel.com/docs/functions/runtimes/python
