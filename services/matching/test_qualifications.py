"""Qualification boundaries with manually specified expected results."""

from copy import deepcopy
import unittest

from demo import OPPORTUNITIES
from engine import match


class QualificationTests(unittest.TestCase):
    def check(self, requirement, profile, expected, reviewed=True):
        opportunity = deepcopy(OPPORTUNITIES[0])
        opportunity['eligibility'] = [requirement]
        ids = [opportunity['opportunity_id']] if reviewed else []
        result = match(profile, [opportunity], reviewed_requirement_ids=ids)['results'][0]
        self.assertEqual(result['eligibility_status'], expected)

    def test_explicit_rules_against_expected_cases(self):
        cases = [
            ('Applicants must have Python skills.', {'skills': ['Python']}, 'eligible'),
            ('Applicants must have Python skills.', {'skills': []}, 'ineligible'),
            ('Applicants must have Python skills.', {}, 'needs_verification'),
            ('Applicants must have Python or R skills.', {'skills': ['Python']}, 'needs_verification'),
            ('Applicants must have completed DSC 10.', {'completed_courses': ['DSC 10']}, 'eligible'),
            ('Applicants must have completed DSC 10.', {'completed_courses': []}, 'ineligible'),
            ('Applicants must have completed DSC 10.', {}, 'needs_verification'),
            ('Applicants must be in year 2 or above.', {'academic_year': 3}, 'eligible'),
            ('Applicants must be in year 2 or above.', {'academic_year': 1}, 'ineligible'),
            ('Applicants must be in year 2 or above.', {}, 'needs_verification'),
            ('Python experience is preferred.', {'skills': []}, 'needs_verification'),
            ('Applicants must have work authorization.', {}, 'needs_verification'),
        ]
        for requirement, profile, expected in cases:
            with self.subTest(requirement=requirement, profile=profile):
                self.check(requirement, profile, expected)

    def test_unreviewed_requirements_cannot_produce_eligible(self):
        self.check('Applicants must have Python skills.', {'skills': ['Python']},
                   'needs_verification', reviewed=False)

    def test_experience_contributes_to_relevance(self):
        result = match({'experiences': [{'title': 'Course project',
            'description': 'A fictional prototype.', 'skills': ['Python']}]}, OPPORTUNITIES)
        self.assertEqual(result['results'][0]['match_score'], 100)
        self.assertIn('Related experience skills', result['results'][0]['match_reasons'][0])


if __name__ == '__main__':
    unittest.main()
