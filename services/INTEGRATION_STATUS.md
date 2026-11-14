# Integration status after merging main

## Latest update: basic public integration passes

Independent rerun returned GET opportunities 200 (9 records), POST fictional
profile 200, POST match 200 (9 results), and local PDF parsing 200 with expected
extracted skills. Token alignment and base URL routing are validated through
D's live proxy. Earlier AI_SERVICE_NOT_CONFIGURED entries below are historical.
Pending: live verified-to-eligible acceptance with reviewed real sources, and
use_ai=true PDF parsing through the complete C/D/B confirmation flow.

## Completed

- Merged origin/main through e39c11a into feature/personalization.
- Resolved the sole .gitignore add/add conflict using main's complete rules,
  after explicit owner approval; no other member's implementation was rewritten.
- All 62 B service offline tests passed after the merge.
- Live GET /api/opportunities returned HTTP 200 and 7 public records.
- All 7 returned opportunity objects were accepted by B's v1.1 adapter.
- Saved one isolated fictional profile as x-demo-user b-integration-20261114;
  POST /api/profile returned HTTP 200. No other profiles were read or changed.

## Current blocker

POST https://ai-academic-compass.vercel.app/api/match returned HTTP 503 with
AI_SERVICE_NOT_CONFIGURED. In D's lib/ai-service.ts this is returned before any
request to B when AI_SERVICE_URL or INTERNAL_TOKEN is missing. This result does
not establish a token mismatch: authentication has not yet been attempted.

The owner/D must configure the Next.js Vercel Production environment:

```dotenv
AI_SERVICE_URL=https://academic-compass-ai.vercel.app
INTERNAL_TOKEN=<SAME_ROTATED_SECRET_AS_THE_AI_PROJECT>
```

Configure the same private token in academic-compass-ai, then redeploy both
projects after secret changes. Do not put secret values in this file or chat.
Secrets are managed by the owner; B does not require DATABASE_URL.

## Remaining acceptance

1. Confirm rotated shared token alignment across the two deployments.
2. Rerun public D -> B matching and PDF extraction:

```bash
.venv/bin/python -B services/ai/check_public_integration.py --save-fictional-profile
```

This explicitly creates/replaces only the named fictional test profile. It uses
the public demo API, no internal secret or database credential, and no Gemini.

3. Validate real opportunities and complete final cross-member acceptance.
The latest 7 public records all use example.com source hosts; none is verified.
They establish schema compatibility only, not real opportunity accuracy.

Node/npm are not installed in the current execution environment. npm install
could not run, and Next.js build/test success is not claimed. No Next.js source
was edited by B; D must verify its application build in the Node environment.
