"""Run fictional examples with: python3 services/matching/demo.py."""

import json

from engine import match


OPPORTUNITIES = [
    {
        "opportunity_id": "00000000-0000-4000-8000-000000000001",
        "title": "Fictional Machine Learning Research Assistant",
        "university": "UCSD", "category": "research",
        "description": "Machine learning research. Python experience is preferred.",
        "deadline": None, "required_skills": [],
        "eligibility": ["Applicants must be undergraduate students.",
                        "Applicants must commit at least 10 hours per week."],
        "source_url": "https://example.org/research",
        "last_verified_at": None, "status": "needs_verification",
    },
    {
        "opportunity_id": "00000000-0000-4000-8000-000000000002",
        "title": "Fictional Biology Workshop",
        "university": "UCSD", "category": "event",
        "description": "An introductory biology workshop with microscopy practice.",
        "deadline": None, "required_skills": [], "eligibility": [],
        "source_url": "https://example.org/workshop",
        "last_verified_at": None, "status": "needs_verification",
    },
]

PROFILES = {
    "fictional_data_science_student": {
        "education_level": "undergraduate", "interests": ["machine learning"],
        "skills": ["Python"], "selected_modules": ["research"],
        "weekly_hours_available": 8,
    },
    "fictional_biology_student": {
        "education_level": "undergraduate", "interests": ["biology"],
        "skills": ["microscopy"], "selected_modules": ["event"],
        "weekly_hours_available": None,
    },
}


if __name__ == "__main__":
    print(json.dumps({name: match(profile, OPPORTUNITIES)
                      for name, profile in PROFILES.items()}, indent=2))
