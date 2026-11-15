# Frontend API client — quick guide for C

All backend calls go through `lib/client/api.ts`. Types live in `lib/client/types.ts`
and match `docs/contracts.md`, so a wrong field name is a TypeScript error.
Use these only inside `"use client"` components.

Public demo: [aiacademiccompass.us](https://aiacademiccompass.us).
See [custom-domain notes](custom-domain.md) for the public URLs and DNS setup.

## 0. Local setup (no database credentials needed)

```bash
git merge origin/main
npm install
echo "API_PROXY_TARGET=https://ai-academic-compass.vercel.app" >> .env.local
npm run dev
```

With `API_PROXY_TARGET` set, your local `/api/*` calls are forwarded to the live
backend. Always call relative paths (`/api/...`) — never hard-code the vercel URL.
The Vercel address above remains the existing development proxy target; the
custom domain is the public entry point. The separate `academic-compass-ai`
project hosts the internal Python service and is not the frontend proxy target.

## 1. Dashboard

```tsx
"use client";
import { useEffect, useState } from "react";
import { loadDashboard, type ApiError } from "@/lib/client/api";
import {
  CATEGORY_LABELS, ELIGIBILITY_STATUS_LABELS, OPPORTUNITY_STATUS_LABELS,
  type OpportunityView,
} from "@/lib/client/types";

const [items, setItems] = useState<OpportunityView[]>([]);
const [matchError, setMatchError] = useState<ApiError | null>(null);

useEffect(() => {
  loadDashboard({ category: ["research", "event"], q: "", sort: "relevance" })
    .then((d) => { setItems(d.items); setMatchError(d.matchError); });
}, []);

// Per card:
//   o.title, CATEGORY_LABELS[o.category], o.organization
//   o.deadline ?? o.deadline_text ?? "Not announced"
//   OPPORTUNITY_STATUS_LABELS[o.status]                  ← is the record verified?
//   o.match && ELIGIBILITY_STATUS_LABELS[o.match.eligibility.status]  ← can THIS student apply?
//   o.match?.relevance_score  (0–100 relevance, NOT acceptance chance; may be null)
//   o.match?.explanation, o.match?.questions_to_confirm
//   o.eligibility.map(r => r.raw_text)  ← requirements, quoted from the source page
//   <a href={o.source_url}>View original source</a>
```

`matchError?.code === "PROFILE_NOT_FOUND"` → link to onboarding.
Any `AI_SERVICE_*` or status 503 → "Personalized ranking is unavailable right now"
(the list still shows).

## 2. Onboarding

```tsx
import { getProfile, saveProfile, parseResume, mergeResumeDraft, splitList, ApiError } from "@/lib/client/api";
import { ACADEMIC_YEARS, ACADEMIC_YEAR_LABELS, CATEGORIES, CATEGORY_LABELS } from "@/lib/client/types";

// Keep ALL fields in state (controlled inputs). Formats the backend expects:
//   academic_year: one of ACADEMIC_YEARS  → render a <select>, label with ACADEMIC_YEAR_LABELS
//   expected_graduation: "YYYY-MM"         → <input type="month"> gives exactly this
//   interests / skills / courses_taken / research_areas / career_goals: string[]
//        → type as text, convert with splitList("Python, SQL")
//   selected_modules: Category[]           → the category checkboxes
//   hours_per_week: integer 0–168 or null
//   work_authorization: only if the student types it (never guess)

try {
  await saveProfile(profile);           // replaces the whole profile — send every field
} catch (e) {
  if (e instanceof ApiError && e.field) {/* highlight e.field, show e.message */}
}
```

Résumé upload (nothing is stored until the student confirms):

```tsx
const draft = await parseResume(file, consentCheckbox);   // consent = send text to Gemini
const { merged, conflicts } = mergeResumeDraft(profile, draft);
// show merged values for review; let the student pick for each conflict; then saveProfile()
```

## 3. Bookmarks

```tsx
import { getBookmarks, saveBookmark, removeBookmark } from "@/lib/client/api";
await saveBookmark(o.opportunity_id);               // "saved"
await saveBookmark(o.opportunity_id, "applying");   // update status
await removeBookmark(o.opportunity_id);
```

## 4. Demo login

Open `/login` and select one of the fictional student accounts. The browser client
sends the signed HttpOnly session cookie with same-origin requests. Use
`useSession()` from `app/components/session.tsx` to read the current session;
do not set a browser-side user ID or call the removed `setDemoUser()` helper.

The legacy `x-demo-user` header is retained by the backend for fictional script
tests only and cannot grant administrator access. Store fictional data only.
