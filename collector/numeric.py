"""Normalize quantitative scalars while preserving units/constraints in raw_text."""
import re

WORDS = dict(zero=0, one=1, two=2, three=3, four=4, five=5, six=6,
             seven=7, eight=8, nine=9, ten=10, eleven=11, twelve=12,
             thirteen=13, fourteen=14, fifteen=15, sixteen=16,
             seventeen=17, eighteen=18, nineteen=19, twenty=20)


def quantitative_value(kind, value):
    if kind not in ('gpa', 'hours_per_week', 'duration'):
        return value
    if not isinstance(value, str):
        return value if value is None or type(value) in (int,float) or kind=='duration' else None
    text = value.strip().lower()
    text = re.sub(r'\b('+'|'.join(WORDS)+r')\b', lambda m: str(WORDS[m[0]]), text)
    if re.fullmatch(r'\d+(?:\.\d+)?', text):
        return float(text) if '.' in text else int(text)
    if kind == 'duration':
        # Numeric value carries magnitude; exact raw_text retains the unit,
        # minimum/preferred qualifiers and consecutive-session constraints.
        match = re.fullmatch(r'(?:at least |minimum |minimum of )?(\d+(?:\.\d+)?) (?:consecutive )?(?:hours?|days?|weeks?|months?|quarters?|years?)', text)
        if match:
            return float(match[1]) if '.' in match[1] else int(match[1])
    if kind in ('gpa', 'hours_per_week'):
        return None
    return text if text != value.strip().lower() else value
