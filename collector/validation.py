"""Checks that require no AI or provider access."""
import re
from datetime import date

def date_in_evidence(expected, evidence):
    patterns = [
        r'\b(\d{4})-(\d{2})-(\d{2})\b',
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
    return False
