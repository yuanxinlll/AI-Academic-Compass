"""Checks that require no AI or provider access."""
import re
from datetime import date

def date_in_evidence(expected, evidence):
    patterns = [
        r'\b(\d{4})-(\d{2})-(\d{2})(?=\b|T\d{2}:\d{2})',
        r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b',
    ]
    for index, pattern in enumerate(patterns):
        for match in re.finditer(pattern, evidence):
            numbers = list(map(int, match.groups()))
            year, month, day = numbers if index == 0 else (numbers[2], numbers[0], numbers[1])
            try:
                if date(year, month, day) == expected:
                    return True
            except ValueError:
                pass
    months = {name.lower(): n for n, name in enumerate([
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'])}
    for name, month in months.items():
        if not name:
            continue
        pattern = rf'\b(?:{name}|{name[:3]}\.?)\s+(\d{{1,2}})(?:st|nd|rd|th)?[,]?\s+(\d{{4}})\b'
        for match in re.finditer(pattern, evidence, re.I):
            try:
                if date(int(match[2]), month, int(match[1])) == expected:
                    return True
            except ValueError:
                pass
        # A shared month/year explicitly qualifies both endpoints of a range.
        pattern = rf'\b(?:{name}|{name[:3]}\.?)\s+(\d{{1,2}})\s*[-\u2013\u2014]\s*(\d{{1,2}}),?\s+(\d{{4}})\b'
        for match in re.finditer(pattern, evidence, re.I):
            try:
                start = date(int(match[3]), month, int(match[1]))
                end = date(int(match[3]), month, int(match[2]))
                if start <= end and expected in (start, end):
                    return True
            except ValueError:
                pass
    return False


_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
           'august', 'september', 'october', 'november', 'december']
_MONTH_RE = r'(?:' + '|'.join(rf'{m}|{m[:3]}\.?' for m in _MONTHS) + r'|sept\.?)'


def single_date(evidence):
    """The one complete date in a deadline quote, or None when there is none or it is ambiguous.

    Rule-based fallback for when the model copied a dated quote but left `deadline` empty.
    Any date mention without a year (e.g. "September 28th") makes the quote ambiguous.
    """
    if not evidence:
        return None
    found, mentions = set(), 0
    for m in re.finditer(r'\b(\d{4})-(\d{2})-(\d{2})\b', evidence):
        mentions += 1
        try: found.add(date(int(m[1]), int(m[2]), int(m[3])))
        except ValueError: return None
    for m in re.finditer(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b', evidence):
        mentions += 1
        if not m[3] or len(m[3]) != 4: return None
        try: found.add(date(int(m[3]), int(m[1]), int(m[2])))
        except ValueError: return None
    for m in re.finditer(rf'\b({_MONTH_RE})\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(,?\s+(\d{{4}})\b)?', evidence, re.I):
        mentions += 1
        if not m[4]: return None
        month = next(i for i, name in enumerate(_MONTHS, 1) if m[1].lower().rstrip('.').startswith(name[:3]))
        try: found.add(date(int(m[4]), month, int(m[2])))
        except ValueError: return None
    return found.pop() if mentions and len(found) == 1 else None
