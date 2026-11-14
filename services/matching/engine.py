"""Deterministic matching prototype; no network or database access."""

import re


def normalize(value):
    return str(value).strip().casefold()


def validate_profile(profile):
    hours = profile.get("weekly_hours_available")
    if hours is not None and (
        isinstance(hours, bool) or not isinstance(hours, (int, float))
        or not 0 <= hours <= 168
    ):
        raise ValueError("weekly_hours_available must be between 0 and 168.")
    for field in ("skills", "interests", "selected_modules"):
        value = profile.get(field)
        if value is not None and (
            not isinstance(value, list)
            or any(not isinstance(item, str) for item in value)
        ):
            raise ValueError(f"{field} must be a list of strings or null.")


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
    return {"source_text": text, "result": result, "reason": reason}


def eligibility(profile, opportunity):
    checks = [check_requirement(profile, text)
              for text in opportunity.get("eligibility", [])]
    if any(item["result"] == "not_met" for item in checks):
        status = "ineligible"
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
    for field, weight in (("interests", 40), ("skills", 40)):
        values = profile.get(field)
        if values:
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
    score = (round(100 * sum(w * value for w, value in dimensions)
                   / sum(w for w, _ in dimensions), 1) if dimensions else None)
    return score, reasons


def match(profile, opportunities):
    validate_profile(profile)
    results = []
    warnings = []
    for opportunity in opportunities:
        status, checks = eligibility(profile, opportunity)
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
