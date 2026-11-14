"""Opt-in adapter for D's draft contract; not a public API or agreed schema.

The caller must explicitly choose the unresolved pending status enum. Empty
arrays remain unknown unless the trusted caller identifies confirmed fields.
"""

from engine import match, normalize

YEARS = {'freshman': 1, 'sophomore': 2, 'junior': 3, 'senior': 4}


def adapt_resume_draft(parsed):
    """Return a draft D-shaped extraction plus review metadata, never a saved profile.

    Unknown arrays are omitted rather than converted to confirmed empty arrays.
    This preserves the difference between missing evidence and explicit absence.
    """
    if not isinstance(parsed, dict) or not isinstance(parsed.get('profile_draft'), dict):
        raise ValueError('Parsed resume must contain a profile_draft object.')
    draft = parsed['profile_draft']
    extracted, field_map = {}, {
        'university': 'university', 'major': 'major', 'skills': 'skills',
        'interests': 'interests', 'completed_courses': 'courses_taken',
    }
    for source, target in field_map.items():
        value = draft.get(source)
        if value is not None:
            extracted[target] = value
    year = draft.get('academic_year')
    level = draft.get('education_level')
    if type(year) is int and year in YEARS.values() and level == 'undergraduate':
        extracted['academic_year'] = next(name for name, number in YEARS.items() if number == year)
        field_map['academic_year'] = 'academic_year'
    elif level == 'graduate' and year is None:
        extracted['academic_year'] = 'graduate'
        field_map['education_level'] = 'academic_year'
    date = draft.get('expected_graduation_date')
    if date is not None:
        from datetime import date as Date
        if not isinstance(date, str):
            raise ValueError('expected_graduation_date must be a date string.')
        Date.fromisoformat(date)
        extracted['expected_graduation'] = date[:7]
        field_map['expected_graduation_date'] = 'expected_graduation'
    experiences = draft.get('experiences')
    if experiences is not None:
        if not isinstance(experiences, list):
            raise ValueError('experiences must be a list or null.')
        mapped = []
        for item in experiences:
            if not isinstance(item, dict):
                raise ValueError('Each experience must be an object.')
            kind = item.get('experience_type')
            # Employment is not necessarily an internship. Do not relabel it.
            mapped.append({'type': kind if kind in ('research', 'project', 'other') else 'other',
                           'title': item.get('title'), 'description': item.get('description'),
                           'organization': None})
        extracted['experiences'] = mapped
        field_map['experiences'] = 'experiences'
    evidence = []
    for entry in parsed.get('evidence', []):
        if not isinstance(entry, dict):
            raise ValueError('Evidence entries must be objects.')
        target = field_map.get(entry.get('field'))
        if target in extracted:
            evidence.append({**entry, 'field': target})
    # Ensure supported profile values pass the same internal validation path.
    from engine import validate_profile
    validate_profile(adapt_profile(extracted))
    return {'extracted': extracted, 'review_metadata': {
        'requires_confirmation': True,
        'parser_mode': parsed.get('parser_mode'),
        'evidence': evidence,
        'warnings': parsed.get('warnings', []),
        'unmapped_fields': {key: value for key, value in draft.items()
                            if value is not None and key not in field_map},
        'original_experiences': experiences,
    }}


def adapt_profile(profile, confirmed_fields=()):
    if not isinstance(profile, dict):
        raise ValueError('Student profile must be an object.')
    confirmed = set(confirmed_fields)
    year = profile.get('academic_year')
    if year is not None and year not in (*YEARS, 'graduate'):
        raise ValueError('Unsupported academic_year in draft contract.')
    normalized = {
        'academic_year': YEARS.get(year),
        'education_level': ('undergraduate' if year in YEARS else 'graduate' if year == 'graduate' else None),
        'weekly_hours_available': profile.get('hours_per_week'),
        'major': profile.get('major'),
    }
    for source, target in (('skills', 'skills'), ('interests', 'interests'),
                           ('selected_modules', 'selected_modules'), ('courses_taken', 'completed_courses')):
        value = profile.get(source)
        normalized[target] = None if value == [] and source not in confirmed else value
    experiences = profile.get('experiences')
    if experiences is not None:
        if not isinstance(experiences, list) or any(not isinstance(e, dict) for e in experiences):
            raise ValueError('experiences must be a list of objects.')
        normalized['experiences'] = []
        for item in experiences:
            title, description = item.get('title'), item.get('description')
            if not isinstance(title, str) or (description is not None and not isinstance(description, str)):
                raise ValueError('Experience title/description has invalid types.')
            normalized['experiences'].append({'title': title, 'description': description or '', 'skills': []})
    # Partial graduation dates are deliberately not converted into full dates.
    return normalized


def check_structured(profile, requirement):
    if not isinstance(requirement, dict):
        raise ValueError('Structured requirements must be objects.')
    kind, value = requirement.get('type'), requirement.get('value')
    hard, raw = requirement.get('is_hard_requirement'), requirement.get('raw_text')
    if not isinstance(kind, str) or type(hard) is not bool or not isinstance(raw, str) or not raw.strip():
        raise ValueError('Requirements need type, raw_text and a boolean is_hard_requirement.')
    result, reason = 'unknown', 'This requirement needs manual verification.'
    fields = {'skill': 'skills', 'course': 'completed_courses', 'major': 'major'}
    if value is None:
        reason = 'The source does not provide a usable requirement value.'
    elif kind == 'hours_per_week':
        available = profile.get('weekly_hours_available')
        if type(value) not in (int, float) or not 0 <= value <= 168:
            reason = 'The required time value is invalid or ambiguous.'
        elif available is None:
            reason = 'Weekly availability has not been confirmed.'
        else:
            result = 'met' if available >= value else 'not_met'
            reason = f'Confirmed availability: {available} hours; required minimum: {value}.'
    elif kind == 'academic_year':
        # Arrays mean an explicit allowed set, not an inferred minimum year.
        allowed = value if isinstance(value, list) else [value]
        actual = ('graduate' if profile.get('education_level') == 'graduate' else
                  next((name for name, number in YEARS.items() if number == profile.get('academic_year')), None))
        if allowed and all(isinstance(v, str) and v in (*YEARS, 'graduate') for v in allowed) and actual:
            result = 'met' if actual in allowed else 'not_met'
            reason = f'Confirmed year: {actual}; allowed years: {", ".join(allowed)}.'
    elif kind in fields:
        actual = profile.get(fields[kind])
        # Lists for skill/course are deliberately ambiguous until A/D confirm
        # whether the list means all-of or any-of. Major lists are also deferred.
        if isinstance(value, str) and value.strip() and actual is not None:
            if any(token in normalize(value) for token in (' or ', ' and ', ',', '/')):
                reason = 'Compound requirements need an agreed all-of or any-of rule.'
            else:
                values = actual if isinstance(actual, list) else [actual]
                result = 'met' if normalize(value) in {normalize(v) for v in values} else 'not_met'
                reason = f'Required {kind}: {value}; comparison uses confirmed profile values.'
    return {'type': kind, 'source_text': raw, 'result': result,
            'reason': reason, 'is_hard_requirement': hard}


def match_contract_draft(profile, opportunities, *, pending_status,
                         confirmed_fields=(), reviewed_requirement_ids=()):
    if pending_status not in ('needs_verification', 'needs_confirmation'):
        raise ValueError('Explicitly select the team-approved pending eligibility enum.')
    if not isinstance(opportunities, list):
        raise ValueError('opportunities must be a list.')
    adapted = adapt_profile(profile, confirmed_fields)
    normalized = []
    requirements = {}
    for item in opportunities:
        if not isinstance(item, dict) or not isinstance(item.get('eligibility'), list):
            raise ValueError('Each opportunity needs a structured eligibility list.')
        requirements[item.get('opportunity_id')] = item['eligibility']
        normalized.append({**item, 'description': item.get('description') or '', 'eligibility': []})
    ranked = match(adapted, normalized)
    reviewed = set(reviewed_requirement_ids)
    results = []
    mapped = {'met': 'eligible', 'not_met': 'ineligible', 'unknown': pending_status}
    for item in ranked['results']:
        identity = item['opportunity_id']
        checks = [check_structured(adapted, req) for req in requirements[identity]]
        hard_checks = [check for check in checks if check['is_hard_requirement']]
        if any(check['result'] == 'not_met' for check in hard_checks):
            status = 'ineligible'
        elif (identity in reviewed and checks
              and all(check['result'] == 'met' for check in hard_checks)):
            status = 'eligible'
        else:
            status = pending_status
        results.append({'opportunity_id': identity, 'eligibility': {
            'status': status, 'checks': [{**check, 'result': mapped[check['result']]} for check in checks]},
            'relevance_score': item['match_score'],
            'explanation': ' '.join(item['match_reasons']) or 'No confirmed relevance signals are available.'})
    return {'results': results}
