# Member B to D: AI service handoff

## Project configuration

- Vercel team: `hhh-967a`
- Project: `academic-compass-ai`
- Dashboard: https://vercel.com/hhh-967a/academic-compass-ai
- Configured production origin: `https://academic-compass-ai.vercel.app`
- Production branch: `feature/personalization`
- Root Directory: `services`
- Framework: FastAPI; entrypoint `main:app`; configured Python 3.12
- Source contract: `feature/backend/docs/contracts.md` v1.1

Deployment `7xs2fNaerFzJpwWePBkS9EaaKsTD` (commit `4546dd2`) is Ready.
The production domain returns the application's UNAUTHORIZED JSON without a
token. Build logs confirm Python 3.12. Initial commit identity and missing runtime
dependency issues were resolved. Authenticated live smoke testing still needs
the owner or D to enter the shared token privately.

Run this from the repository root; the token prompt is hidden and not saved:

```bash
.venv/bin/python -B services/ai/check_deployment.py
```

The script checks missing-token rejection, authenticated matching and a fictional
PDF with use_ai=false. It does not call Gemini or consume model quota.

## Variables to configure in D's Next.js project

```dotenv
AI_SERVICE_URL=https://academic-compass-ai.vercel.app
INTERNAL_TOKEN=<ENTER_THE_SAME_SECRET_CONFIGURED_IN_THE_AI_PROJECT>
```

The owner shares INTERNAL_TOKEN privately. Never paste it in this file, chat,
client components or a NEXT_PUBLIC_ variable. Gemini credentials are configured
only in the AI service; D does not need to receive the Gemini key for proxy calls.
The owner has saved GEMINI_API_KEY and INTERNAL_TOKEN as Production Secrets in
the AI project. Only their names/type/scope were checked, not secret values.
GEMINI_MODEL is configured as gemini-4-hydrogen.

## Match call (server-side only)

```typescript
const origin = process.env.AI_SERVICE_URL;
const token = process.env.INTERNAL_TOKEN;
if (!origin || !token) throw new Error("AI service is not configured");

const response = await fetch(`${origin.replace(/\/$/, "")}/internal/match`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-internal-token": token,
  },
  body: JSON.stringify({ profile, opportunities }),
  signal: AbortSignal.timeout(45000),
  cache: "no-store",
});
const result = await response.json();
// Preserve response.status and the contract error shape in D's /api/match route.
```

D authenticates the student, loads the session-owned profile and opportunity
records from Neon, and passes complete v1.1 objects. The public request contains
optional opportunity_ids only; never accept another student's user_id/profile
from the browser as authoritative. The AI service has no database credentials.

## Resume call (server-side only)

```typescript
const form = new FormData();
form.append("file", file);
form.append("use_ai", consent ? "true" : "false");

const response = await fetch(`${origin.replace(/\/$/, "")}/internal/resume/parse`, {
  method: "POST",
  headers: { "x-internal-token": token },
  body: form,
  signal: AbortSignal.timeout(45000),
});
// Do not set Content-Type manually: FormData creates its multipart boundary.
const result = await response.json();
// Success: { extracted: Partial<StudentProfile> }. Save only after user review.
```

PDF maximum is 4 MiB and 10 pages. Explicit consent is required for use_ai=true.
False uses local labeled-field extraction. Profiles and source files are not
persisted by the AI service. Missing array fields are omitted in extracted output.

## Response and error checks

- Success match: `{ results: [...] }`; relevance_score can be null, sorted last.
- Qualification result: eligible / ineligible / needs_confirmation.
- Opportunity status remains verified / needs_verification / expired.
- Only verified opportunities may produce eligible; explicit hard failures take
  precedence. Preferred conditions never disqualify a student.
- 401 UNAUTHORIZED: missing or mismatched INTERNAL_TOKEN.
- 503 SERVICE_NOT_CONFIGURED: AI deployment lacks INTERNAL_TOKEN.
- 413 FILE_TOO_LARGE: PDF exceeds 4 MiB.
- 415/422: unsupported, malformed or textless PDF.
- 503 AI_NOT_CONFIGURED / AI_ACCESS_DENIED / AI_RATE_LIMITED: provider configuration,
  permission or quota. Do not expose provider response bodies or credentials.
- A Vercel HTML sign-in page indicates platform Deployment Protection, not this
  application's JSON authentication. Configure authorized server access separately.

## Acceptance checklist

- [x] AI deployment shows Ready and Python 3.12 is confirmed in build logs.
- [x] Request without token returns the application's UNAUTHORIZED JSON.
- [ ] Matching with a fictional v1.1 profile returns HTTP 200.
- [ ] Verified empty eligibility produces eligible; unverified produces needs_confirmation.
- [ ] Empty student skills do not produce an automatic skill failure.
- [ ] Fictional PDF with use_ai=false returns extracted fields.
- [ ] Fictional PDF with use_ai=true succeeds after explicit consent.
- [ ] C reviews the draft before D saves the authenticated student's profile.

Local validation: 62 offline tests passed; deployed acceptance must be recorded
separately. This file contains placeholders only and is safe to share with D.
