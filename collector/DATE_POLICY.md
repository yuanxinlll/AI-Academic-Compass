# Instagram missing-year policy

User-authorized on 2026-11-15. This supersedes the earlier blanket refusal to
assign a missing year for attested Instagram posts only. General webpage
extraction, eligibility rules, and the shared API schema remain unchanged.

1. Prefer an explicit complete date in the actual source or its exact linked
   event page. Do not replace a stated year with an inferred one.
2. Otherwise retain the exact printed month/day/time quotation. Use the post's
   original timestamp, converted to America/Los_Angeles, as the calendar anchor.
   Assign the earliest valid occurrence of that month/day on or after the post
   date: same year when applicable, otherwise the next year (next leap year for
   February 29). Never anchor to the collection date or an unrelated title year.
3. Apply this rule only after quotation validation. Multiple conflicting dates,
   missing posting dates, invalid calendar dates and absent month/day remain
   unresolved. Events without a resolved date stay held for date review.
4. Retain printed times verbatim in evidence; do not invent an absent time,
   midnight deadline, or timezone. The shared deadline is date-only, so this
   change does not add a public event-time field.
5. Retain original deadline_text. Date interpretations in local state/report
   include raw_text, posted_at, anchor_date, assigned date, timezone and policy.
   The existing public description labels an assigned year as inferred and
   needing verification. Inference does not mark a record verified.

Example: a November 9, 2026 post saying priority deadline 11/26 resolves to
2026-11-26, even when the competition itself takes place in January 2027.
The exact linked RAG RSVP page explicitly dates the workshop to November 12,
2026; that confirmed date takes precedence and the event stays expired.

Only exact public Luma RSVP pages are automatically consulted at present.
A manual check of https://datahacks.ds3ucsd.com/ confirmed the 2027 event title
but exposed no explicit priority-deadline year; the November 26 year therefore
remains a retained interpretation, not an independently confirmed deadline.
D/B/C should preserve the interpretation warning in display/matching. No new
shared fields or database migration were introduced.
