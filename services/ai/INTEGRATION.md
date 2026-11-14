> v1.1 update: the contract is now confirmed. The authenticated FastAPI service is services/main.py; see ../README.md. Earlier draft blockers below are retained as history and no longer block implementation. Deployment and cross-member acceptance remain pending.

# Member B integration handoff

Status: callable Python worker ready for integration. Public HTTP contracts remain
proposals until members A/C/D agree. No Next.js route or database file was changed.

## Invocation

Launch the project virtual environment's Python executable with an absolute path
to `services/ai/worker.py`. Send one JSON request on stdin, close stdin, and parse
one JSON response on stdout. Do not construct shell commands from user input.
Use a subprocess API with an argument array and no shell. Supply Gemini variables
only to the server-side process. Never return credentials or raw provider errors.

The worker supports local subprocess integration on a Python-capable host. It does
not establish that Python is available in the team's Vercel deployment. Member D
must confirm hosting or provide a separately deployed Python service. No FastAPI
service or second hosting architecture has been introduced.

## Match request

```json
{
  "operation": "match",
  "profile": {
    "education_level": "undergraduate",
    "interests": ["machine learning"],
    "skills": ["Python"],
    "selected_modules": ["research"],
    "weekly_hours_available": 8
  },
  "opportunities": []
}
```

Member D loads authorized opportunity records from the database and supplies the
full objects. Each needs a unique string `opportunity_id`, string `title` and
`description`, an agreed category, and string-array `eligibility`/`required_skills`.
The worker does not fetch URLs or connect to the database. It does not trust client
provided opportunity records as authoritative; the HTTP layer must resolve IDs.

Success response (exit 0):

```json
{"ok": true, "data": {"results": [], "warnings": []}}
```

## Resume request

```json
{"operation": "parse_resume", "pdf_base64": "BASE64_PDF_BYTES", "use_ai": false}
```

Base64 is an internal transport only; the browser upload contract remains multipart.
Set `use_ai` to true only with explicit consent to transmit text to Google. False
uses labeled-field extraction without network access. The result contains
`profile_draft`, `evidence`, `requires_confirmation`, `parser_mode` and `warnings`.
Do not persist this as a confirmed profile until the student reviews it.

Failure response (exit 1):

```json
{"ok": false, "error": {"code": "INVALID_INPUT", "message": "Request must be a JSON object.", "status": 400}}
```

## Responsibilities and pending decisions

- A: provide real records and verbatim qualification text; confirm eligibility
  completeness. Unknown text is not automatically classified as a hard requirement.
- B: extraction, validation, conservative qualification checks and relevance ranking.
- C: upload consent, editable draft confirmation, pending-verification display,
  relevance score labeling and source links from the original opportunity object.
- D: authentication, authorization, upload limits, process timeouts/resource limits,
  persistence, request/response agreement and Python hosting. The demo has no auth.

Eligibility rules support narrow undergraduate, time, single-skill, completed-course
and minimum-year patterns. Compound or unknown requirements remain unverified.
The internal Python match function accepts reviewed_requirement_ids only from a
trusted reviewer; it can return eligible when all reviewed conditions pass.
The worker and demo do not expose this flag to clients. Production review ownership
and storage require team agreement. Semantic matching accuracy is not established. Latest user-reported connection check
returned PASS; agent-run live Gemini/PDF validation has not been performed.

## Verification

The worker was exercised through real subprocesses for matching, PDF parsing and
invalid requests. No HTTP port is needed for those checks. From services/matching:

```bash
../../.venv/bin/python -B -m unittest test_engine test_resume test_gemini test_worker test_api.ProfileMergeTests -v
```

Production target Python 3.11+; current local test environment is Python 3.9.6.
