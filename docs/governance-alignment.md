# Governing-plan alignment - 2026-11-14

Authority: the complete Chinese plan and coding rules supplied by the user in
this conversation, compared with the existing workspace English plan/rules and
freshly fetched origin/main. The maintained English plan is hackathon-plan.md;
repository AGENTS.md contains engineering constraints. This is a comparison and
open-decision record, not a substitute API schema or an implementation status claim.

## Git synchronization

Fetched origin, including frontend branch advancement from 818e51d to e578438.
origin/main remains ffb2792. Its changes were merged into feature/collection as
e42d28d after a conflict-free merge-tree check. Existing modified and untracked
collector documentation was preserved. Other teammates' unmerged feature branches
were fetched, not merged: latest main is the integration baseline, not every
unreviewed feature branch. No force push, reset, deletion, or push was performed.

## Comparison and resulting guidance

| Chinese source | Existing governing text | Result |
| --- | --- | --- |
| Coding rules 1-3, 6-10 | Most stack, naming, ownership, security and change boundaries already present in workspace AGENTS.md; repository AGENTS.md contained only Next.js-generated guidance | Preserve engineering rules in repository AGENTS.md and retain generated Next.js block. Workspace AGENTS.md now points there. |
| Sections 1, 2, 3.3 | English plan already describes automated collection and all six categories | Retain those requirements and make explicit in agent rules: research-only collection and UCSD-host-only relevance are not product constraints. Company internships and campus jobs are expressly included. No equal-category quota is specified. |
| Sections 3.1-3.5 | Onboarding, optional resume use, sensitive-data confirmation, evidence-based eligibility and accessible low-ranked opportunities already covered | Retain; distinguish optional student resume use from required implementation of upload/extraction. Do not infer identity or missing requirements. |
| Section 3.6 | Dashboard feed, category modules, search, sorting, bookmarks, application tracking, source access and editable profiles already covered | Preserve. Calendar/reminder/planning additions remain lower priority; do not treat every dashboard feature as first-priority MVP. |
| Sections 4, 8-10 | English plan already has sampling limitations, milestone ordering, three priority levels and evaluation proposals | Preserve and surface in coding rules. Automatic updates are second priority; automatic collection itself is required. A source-reviewed manifest is not a human-labeled extraction benchmark. |
| Sections 5-7 | Tools, ownership, suggested layout and example routes largely match | Preserve existing implementation-compatible refinements. A saves through D's current admin-ingestion API; D owns routes, auth, schema and deployment. Suggested directories do not authorize restructuring. |
| Coding rule 4 | Chinese minimal opportunity example omits some fields already agreed in detailed contract | Keep minimal example illustrative. Do not remove organization, structured eligibility, deadline_text, application_method or system fields from the existing interface. |
| Coding rule 4 versus contracts.md header | Latest coding rules require team confirmation for added fields; contract header permitted adding fields directly | Replace the permissive header clause with team-confirmed shared-schema changes. No field or schema was changed. |
| Sections 11-15 | Awards, risks, demo and roadmap already represented in English | Preserve. Award eligibility is unconfirmed until official rules are checked; no new award verification was requested here. |

## Unresolved differences requiring team confirmation

1. **Student eligibility enum/shape.** Chinese coding rule 4 says
   eligibility_status = eligible / ineligible / needs_verification. Current
   contracts.md and implemented integrations use eligibility.status with
   needs_confirmation. Opportunity verification independently uses
   needs_verification. Preserve the existing wire interface for compatibility;
   B/D/team must confirm the governing wording or an explicit migration before
   changing it. No enum or payload was changed by this update.
2. **Collector trigger versus ingestion.** The plan proposes POST /api/collect;
   the current detailed agreement uses POST /api/admin/opportunities for ingestion
   and leaves the trigger optional. These have different purposes. Retain the
   implemented ingestion route; coordinate any deployed trigger with D.
3. **External-source edge cases.** Company internships, research-institute
   internships and campus jobs are in scope for UCSD undergraduates. The plan
   does not define indiscriminate global-job coverage, paid-resource boundaries
   or detailed trusted-domain policy. A should maintain relevant primary-source
   discovery; resolve ambiguous cases without blocking clearly included categories.
4. **University field for external organizers.** The plan calls for the associated
   university or institution while the detailed contract is campus-oriented and
   provides organization separately. Agree mapping with B/D before changing
   shared semantics or hardcoded extraction behavior.

## Maintained locations and validation boundary

- Repository AGENTS.md: engineering instructions plus preserved Next.js block.
- docs/hackathon-plan.md: existing full English plan reconciled with Chinese source.
- docs/contracts.md: detailed API/schema; only field-addition approval text changed.
- Parent workspace AGENTS.md and hackathon-plan.md: compatibility pointers to the
  versioned sources, replacing independent copies. Existing plan content was
  retained in the repository plan rather than discarded.
- collector/PROJECT_AUDIT.md: collector gaps and A/D coordination, updated for
  the merge and confirmed six-category scope.

Facts: docs/rules are changed-and-verified by readback, required-section checks,
local Markdown link checks and git diff --check. Git workspace is verified-current
against fetched main, with local documentation pending commit/review. Existing
application behavior was not deliberately edited; the merge incorporates main's
code as requested. Runtime/deployment and live end-to-end behavior are out-of-scope
for this documentation update. No memory system was modified (not-applicable).
New ingestion transport, discovery coverage, scheduler and benchmark remain
pending implementation; governance edits do not complete those tasks.
