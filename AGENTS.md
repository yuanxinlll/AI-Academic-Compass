# Academic Compass engineering instructions

Academic Compass has four owners covering collection, AI personalization, frontend, and backend integration. See the [SanD Hacks project plan](docs/hackathon-plan.md) for scope, milestones, and the demo.

## Product scope and priorities

- Follow [the project plan](docs/hackathon-plan.md), reconciled with the latest
  Chinese plan supplied by the user on 2026-11-14. Automated collection is the
  core product; personalization supports it; Data for Good is an extension.
- Start with UCSD undergraduates. Cover all six agreed categories, including
  company/research-institute internships, campus jobs, academic events,
  competitions, fellowships/exchanges, courses, training and learning resources.
  Do not narrow collection to research or equate relevance with a ucsd.edu host.
- Use both known-source monitoring and new-source discovery. Bright Data fetches
  pages; it does not replace discovery. Prefer reliable primary sources and
  permitted public access. Retain source evidence and uncertain information.
- Deliver automatic fetch, extraction, validation and persistence from a real
  source. Periodic updates remain a product requirement and second-priority MVP
  feature; do not claim a deployed scheduler from a local monitoring loop.
- Keep the required end-to-end demo ahead of UCLA expansion, transparency charts,
  Mastra, calendar sync and reminders. Resume upload must be implemented for the
  MVP but remains optional for each student.
- Personalization must keep all opportunities accessible. Separate eligibility
  from relevance; a match score is not an admission probability. Require student
  confirmation of extracted profile data and never infer sensitive identities.
- Evaluate extraction against roughly 20-30 human-verified listings; report
  extraction, deduplication, eligibility and collection metrics honestly. Source
  review notes alone do not constitute a measured accuracy benchmark.
- Collected counts describe sampled pages, not all resources a university offers.
  Explain source selection and coverage limitations in cross-campus comparisons.

## Stack and conventions

- Use Next.js, React, TypeScript, and Tailwind CSS for the frontend, and Next.js Route Handlers for backend APIs.
- Use Python 3.11+ for collection, cleaning, AI processing, and matching. Use FastAPI only if a standalone Python service is needed. The team decides together whether and where to deploy such a service.
- Use Neon PostgreSQL for storage, JSON for data exchange, npm for frontend packages, and pip with `requirements.txt` for Python packages. Deploy the Next.js app on Vercel.
- Get team approval before introducing a second frontend framework, ORM, database, authentication system, or package manager.
- Use `.tsx` for React pages and components, `.ts` for frontend utilities and API code, and `.py` for Python.
- Use `snake_case` for JSON fields, Python functions and variables, and database tables and columns. Use `camelCase` for TypeScript functions and variables and `PascalCase` for React components.
- Use ISO 8601 timestamps with an explicit time zone and store database times in UTC. Use `null` for missing dates. Use database-generated unique IDs and avoid array indexes as identifiers.

## Module ownership

| Owner | Main directories | Scope |
| --- | --- | --- |
| A — Data collection | `collector/` | Fetch pages, extract and clean records, and deduplicate opportunities. |
| B — AI personalization | `services/ai/`, `services/matching/` | Parse résumés, assess eligibility, and rank opportunities. |
| C — Frontend | `app/` pages, `components/` | Build pages, components, styling, and interactions. Leave `app/api/` to D. |
| D — Backend and integration | `app/api/`, `lib/database/`, `database/` | Maintain APIs, database access, authentication, and deployment configuration. |

Get explicit approval before editing another member’s files.

## Shared opportunity contract

All modules use the same data contract. This example shows the agreed opportunity fields.

```json
{
  "opportunity_id": "uuid",
  "title": "string",
  "university": "string",
  "category": "research",
  "description": "string",
  "deadline": null,
  "required_skills": [],
  "eligibility": [],
  "source_url": "string",
  "last_verified_at": null,
  "status": "needs_verification"
}
```

- Allowed values for `category` are `research`, `internship`, `event`, `competition`, `program`, and `course`.
- Use `status` for opportunity verification, separately from a student's eligibility.
  The supplied Chinese coding rules name the student pending value
  `needs_verification`; the current shared API contract uses
  `eligibility.status = "needs_confirmation"`. This discrepancy is pending team
  confirmation. Preserve the current API shape and enum for compatibility; do
  not silently rename either the field or value. See
  [governance alignment](docs/governance-alignment.md).
- The JSON above is the plan's minimal illustrative object, not an exhaustive
  replacement for [docs/contracts.md](docs/contracts.md). Preserve its existing
  structured eligibility and additional agreed fields. Schema/API changes need
  team confirmation, including additions.
- Get team approval before changing field names, types, or enum values. Update the shared schema and obtain team confirmation before adding fields to the contract.

## API conventions

Use the `/api/` prefix. The initial API agreement includes the following routes.

- `GET /api/opportunities`
- `POST /api/profile`
- `POST /api/resume/parse`
- `POST /api/match`
- `POST /api/bookmarks`

The plan also proposes admin/internal-only `POST /api/collect`. The existing
integration agreement uses D's authenticated `POST /api/admin/opportunities`
for A's ingestion; preserve it. A owns collection code and D owns Next.js routes.
Do not replace the current integration with the plan's illustrative route list.

Use the detailed shared contract for endpoint-specific formats (including
multipart PDF uploads). Exchange structured JSON, keep field names consistent, validate inputs, and return explicit HTTP status codes. Keep database credentials and third-party API keys out of responses. Propose public interface changes to the team and obtain approval before changing request or response formats.

## Change boundaries

Keep each change focused. Get explicit approval before restructuring the project, changing directories or the stack, changing the database schema, renaming a public function or API, removing behavior, or editing another module’s dependencies or code. Avoid destructive automatic migrations and rewrites of unrelated files.

Before coding, identify the owning module, read the relevant files and shared interfaces, and identify which files need edits. Reuse compatible functions and types and avoid duplicate implementations. Preserve compatibility with existing code.

After coding, list the files changed, summarize the changes and their effects on other modules, give the relevant test commands or steps, and identify anything still unverified. Report tests as passing only after running them.

## Git and dependencies

- Work on a feature branch and merge via pull request. Keep direct changes off `main`.
- Get approval before force-pushing. Preserve teammates’ uncommitted work and Git history.
- Change `package.json`, `package-lock.json`, or `requirements.txt` only when needed. Explain new dependencies first and avoid overlapping packages.
- If a merge conflict arises, show the conflict and confirm the resolution before choosing which changes to keep.

## Secrets and data

- Read API keys, database passwords, and other secrets through environment variables. Keep secrets out of source code and keep `.env` files and real résumés out of commits.
- Collect sensitive identity/work-authorization information only when needed and
  voluntarily supplied and confirmed by the student. Keep public opportunity
  records separate from private profiles; enforce access through authenticated
  user identity, never a client-supplied user ID.
- Use synthetic student data for tests. Preserve the original source link for each opportunity.
- Use `null` or `needs_verification` for missing or uncertain information where applicable. AI must leave unsupported deadlines, eligibility details, and recruitment status unknown.

## Resolving conflicts with the architecture

Preserve compatibility with the team’s code, contracts, data structures, and stack when choosing a local implementation. If a task conflicts with the architecture, identify the conflict and propose a compatible approach. Get team confirmation before proceeding with an incompatible change. Keep work within the assigned module.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
