"""Deterministic matching prototype; no network or database access."""

import re


def normalize(value):
    return str(value).strip().casefold()


def validate_profile(profile):
    if not isinstance(profile, dict):
        raise ValueError("profile must be a JSON object.")
    level = profile.get("education_level")
    if level not in (None, "undergraduate", "graduate", "other"):
        raise ValueError("education_level must be undergraduate, graduate, other or null.")
    year = profile.get("academic_year")
    if year is not None and (type(year) is not int or not 1 <= year <= 4):
        raise ValueError("academic_year must be an integer from 1 to 4 or null.")
    hours = profile.get("weekly_hours_available")
    if hours is not None and (
        isinstance(hours, bool) or not isinstance(hours, (int, float))
        or not 0 <= hours <= 168
    ):
        raise ValueError("weekly_hours_available must be between 0 and 168.")
    for field in ("skills", "interests", "selected_modules", "completed_courses"):
        value = profile.get(field)
        if value is not None and (
            not isinstance(value, list)
            or any(not isinstance(item, str) or not item.strip() for item in value)
        ):
            raise ValueError(f"{field} must be a list of strings or null.")
    categories = {"research", "internship", "event", "competition", "program", "course"}
    if any(item not in categories for item in profile.get("selected_modules") or []):
        raise ValueError("selected_modules contains an unsupported category.")
    experiences = profile.get("experiences")
    if experiences is not None:
        if not isinstance(experiences, list):
            raise ValueError("experiences must be a list or null.")
        for item in experiences:
            if (not isinstance(item, dict)
                    or any(not isinstance(item.get(key), str) for key in ("title", "description"))
                    or not isinstance(item.get("skills"), list)
                    or any(not isinstance(skill, str) for skill in item["skills"])):
                raise ValueError("Each experience needs title, description and a skills list.")


def validate_opportunities(opportunities):
    if not isinstance(opportunities, list):
        raise ValueError("opportunities must be a JSON array.")
    seen = set()
    for item in opportunities:
        if not isinstance(item, dict):
            raise ValueError("Each opportunity must be a JSON object.")
        identity = item.get("opportunity_id")
        if not isinstance(identity, str) or not identity.strip() or identity in seen:
            raise ValueError("Each opportunity_id must be a unique nonempty string.")
        seen.add(identity)
        for field in ("title", "description"):
            if not isinstance(item.get(field), str):
                raise ValueError(f"Opportunity {field} must be a string.")
        if item.get("category") not in ("research", "internship", "event", "competition", "program", "course"):
            raise ValueError("Opportunity category is unsupported.")
        for field in ("eligibility", "required_skills"):
            values = item.get(field)
            if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                raise ValueError(f"Opportunity {field} must be a list of strings.")


def check_requirement(profile, text):
    """Only recognize narrow, explicit rules; preserve all other text as unknown."""
    rule = normalize(text).rstrip(".")
    result = "unknown"
    reason = "This requirement needs manual verification."
    if rule == "applicants must be undergraduate students":
        level = profile.get("education_level")
        if level is not None:
            result = "met" if level == "undergraduate" else "not_met"
            reason = f"Your confirmed education level is {level}."
        else:
            reason = "Education level has not been provided."
    else:
        hours_rule = re.fullmatch(
            r"applicants must commit at least (\d+) hours per week", rule
        )
        if hours_rule:
            minimum = int(hours_rule.group(1))
            available = profile.get("weekly_hours_available")
            if available is not None:
                result = "met" if available >= minimum else "not_met"
                reason = (
                    f"Your weekly availability is {available} hours; "
                    f"this opportunity requires at least {minimum}."
                )
            else:
                reason = "Weekly availability has not been provided."
        else:
            patterns = (
                (r"applicants must have (.+) skills", "skills"),
                (r"applicants must have completed (.+)", "completed_courses"),
            )
            for pattern, field in patterns:
                condition = re.fullmatch(pattern, rule)
                if condition:
                    required = condition.group(1).strip()
                    # Compound expressions need explicit parsing rather than
                    # treating 'Python or R' as a single absent skill.
                    if any(token in required for token in (" and ", " or ", ",", "/")):
                        break
                    values = profile.get(field)
                    if values is None:
                        reason = f"{field} has not been provided."
                    else:
                        found = required in {normalize(v) for v in values}
                        result = "met" if found else "not_met"
                        reason = f"Required {field} item '{required}' is {'present' if found else 'not listed'} in your confirmed profile."
                    break
            year_rule = re.fullmatch(r"applicants must be in year ([1-4]) or above", rule)
            if year_rule:
                year = profile.get("academic_year")
                if year is None:
                    reason = "Academic year has not been provided."
                else:
                    minimum = int(year_rule.group(1))
                    result = "met" if year >= minimum else "not_met"
                    reason = f"Your academic year is {year}; the minimum is {minimum}."
    return {"source_text": text, "result": result, "reason": reason}


def eligibility(profile, opportunity, requirements_reviewed=False):
    checks = [check_requirement(profile, text)
              for text in opportunity.get("eligibility", [])]
    if any(item["result"] == "not_met" for item in checks):
        status = "ineligible"
    elif requirements_reviewed and checks and all(item["result"] == "met" for item in checks):
        status = "eligible"
    else:
        # Passing recognized rules does not establish that all source requirements
        # were captured. The shared schema has no completeness indicator yet.
        status = "needs_verification"
    return status, checks


def relevance(profile, opportunity):
    """Weighted lexical relevance, independent of eligibility (not a probability)."""
    searchable = normalize(
        opportunity.get("title", "") + " " + opportunity.get("description", "")
    )
    dimensions = []
    reasons = []
    for field, weight in (("interests", 35), ("skills", 35)):
        values = profile.get(field)
        if values:
            values = list(dict.fromkeys(normalize(value) for value in values))
            matches = [value for value in values if re.search(
                r"(?<!\w)" + re.escape(normalize(value)) + r"(?!\w)", searchable
            )]
            dimensions.append((weight, len(matches) / len(values)))
            if matches:
                reasons.append(f"Matching {field}: {', '.join(matches)}.")
    categories = profile.get("selected_modules")
    if categories:
        matched = opportunity.get("category") in categories
        dimensions.append((20, float(matched)))
        if matched:
            reasons.append("This opportunity belongs to a selected category.")
    experience_skills = list(dict.fromkeys(
        normalize(skill) for experience in profile.get("experiences") or []
        for skill in experience["skills"] if skill.strip()))
    if experience_skills:
        matches = [skill for skill in experience_skills if re.search(
            r"(?<!\w)" + re.escape(skill) + r"(?!\w)", searchable)]
        dimensions.append((10, len(matches) / len(experience_skills)))
        if matches:
            reasons.append(f"Related experience skills: {', '.join(matches)}.")
    score = (round(100 * sum(w * value for w, value in dimensions)
                   / sum(w for w, _ in dimensions), 1) if dimensions else None)
    return score, reasons


def match(profile, opportunities, reviewed_requirement_ids=None):
    """Reviewed IDs must come from trusted internal review, never a student request."""
    validate_profile(profile)
    validate_opportunities(opportunities)
    results = []
    warnings = []
    reviewed = set(reviewed_requirement_ids or [])
    for opportunity in opportunities:
        reviewed_requirements = opportunity["opportunity_id"] in reviewed
        status, checks = eligibility(profile, opportunity, reviewed_requirements)
        score, reasons = relevance(profile, opportunity)
        results.append({
            "opportunity_id": opportunity["opportunity_id"],
            "eligibility_status": status,
            "eligibility_checks": checks,
            "match_score": score,
            "match_reasons": reasons,
            "questions_to_confirm": [item["source_text"] for item in checks
                                     if item["result"] == "unknown"],
        })
        if not reviewed_requirements:
            warnings.append({
                "opportunity_id": opportunity["opportunity_id"],
                "code": "REQUIREMENT_COMPLETENESS_UNVERIFIED",
                "message": "Confirm that all source requirements have been captured.",
            })
    results.sort(key=lambda item: (
        item["match_score"] is None,
        -(item["match_score"] or 0), item["opportunity_id"]
    ))
    return {"results": results, "warnings": warnings}
