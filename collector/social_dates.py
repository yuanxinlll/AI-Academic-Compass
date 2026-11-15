"""User-authorized missing-year policy for dated organization posts only."""
import calendar
import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

POLICY = 'next_occurrence_on_or_after_post_date_v1'
ZONE = ZoneInfo('America/Los_Angeles')


def resolve_yearless(text, posted_at):
    """Resolve a single month/day; retain times verbatim, never invent midnight."""
    if not text or not posted_at or re.search(r'\b(?:19|20|21)\d{2}\b', text):
        return None
    posted = datetime.fromisoformat(posted_at.replace('Z', '+00:00'))
    if posted.tzinfo is None:
        return None
    anchor = posted.astimezone(ZONE).date()
    candidates = set()
    for match in re.finditer(r'(?<![\d/])(\d{1,2})/(\d{1,2})(?![\d/])', text):
        candidates.add((int(match[1]), int(match[2])))
    for month in range(1, 13):
        name = calendar.month_name[month]
        pattern = rf'\b(?:{name}|{name[:3]}\.?)\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*[-\u2013\u2014]\s*(\d{{1,2}}))?\b'
        for match in re.finditer(pattern, text, re.I):
            candidates.add((month, int(match[2] or match[1])))
    if len(candidates) != 1:
        return None
    month, day = candidates.pop()
    # Permit the next leap day, but never repair an impossible calendar date.
    for year in range(anchor.year, anchor.year + 9):
        try:
            resolved = date(year, month, day)
        except ValueError:
            continue
        if resolved >= anchor:
            return dict(date=resolved.isoformat(), raw_text=text, posted_at=posted_at,
                        anchor_date=anchor.isoformat(), timezone=ZONE.key,
                        basis='inferred_year', policy=POLICY,
                        time_policy='Printed times retained verbatim; no missing time invented.')
    return None


def apply_policy(records, items, source_text, posted_at, support):
    from collector.text import evidence_in
    evidence = []
    for record, item in zip(records, items):
        deadline_text = record.get('deadline_text')
        if record['deadline'] is None and evidence_in(deadline_text, source_text):
            resolved = resolve_yearless(deadline_text, posted_at)
            if resolved:
                record['deadline'] = resolved['date']
                evidence.append(dict(field='deadline', **resolved))
        activity_text = item.get('activity_end_text')
        if not support and not item.get('activity_end_date') and evidence_in(activity_text, source_text):
            resolved = resolve_yearless(activity_text, posted_at)
            if resolved:
                evidence.append(dict(field='activity_end_date', **resolved))
        notes = [f"{e['field']} {e['date']}: year inferred from post date under {POLICY}; source text: {e['raw_text']}" for e in evidence]
        if notes:
            record['description'] = (record.get('description') or '') + '\nDate interpretation (needs verification): ' + ' | '.join(notes)
    return evidence
