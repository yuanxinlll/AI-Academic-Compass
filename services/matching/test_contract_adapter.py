"""Draft-schema adapter tests; all profiles and records are fictional."""

from copy import deepcopy
import unittest
from contract_adapter import adapt_profile, match_contract_draft
from demo import OPPORTUNITIES


class ContractAdapterTests(unittest.TestCase):
    def invoke(self, requirement, profile=None, reviewed=False, confirmed=()):
        opportunity = deepcopy(OPPORTUNITIES[0])
        opportunity['eligibility'] = [requirement]
        opportunity['description'] = None
        return match_contract_draft(profile or {'academic_year': 'sophomore'}, [opportunity],
            pending_status='needs_verification', confirmed_fields=confirmed,
            reviewed_requirement_ids=[opportunity['opportunity_id']] if reviewed else [])['results'][0]

    def rule(self, kind, value, hard=True):
        return {'type': kind, 'value': value, 'raw_text': 'Fictional source requirement.',
                'is_hard_requirement': hard}

    def test_maps_profile_without_fabricating_dates_or_experience_skills(self):
        result = adapt_profile({'academic_year': 'junior', 'hours_per_week': 12,
            'expected_graduation': '2028-06', 'courses_taken': ['DSC 10'],
            'experiences': [{'type': 'project', 'title': 'Example', 'description': None}]})
        self.assertEqual(result['academic_year'], 3)
        self.assertEqual(result['weekly_hours_available'], 12)
        self.assertEqual(result['experiences'][0]['skills'], [])
        self.assertNotIn('expected_graduation_date', result)

    def test_empty_unconfirmed_skills_are_unknown(self):
        result = self.invoke(self.rule('skill', 'Python'), {'skills': []})
        self.assertEqual(result['eligibility']['status'], 'needs_verification')

    def test_confirmed_empty_skills_fail_hard_requirement(self):
        result = self.invoke(self.rule('skill', 'Python'), {'skills': []}, confirmed=['skills'])
        self.assertEqual(result['eligibility']['status'], 'ineligible')

    def test_preference_failure_does_not_disqualify(self):
        result = self.invoke(self.rule('skill', 'Python', False), {'skills': ['R']}, reviewed=True)
        self.assertEqual(result['eligibility']['status'], 'eligible')

    def test_time_and_allowed_years(self):
        result = self.invoke(self.rule('hours_per_week', 10), {'hours_per_week': 8})
        self.assertEqual(result['eligibility']['status'], 'ineligible')
        result = self.invoke(self.rule('academic_year', ['junior', 'senior']), {'academic_year': 'senior'}, reviewed=True)
        self.assertEqual(result['eligibility']['status'], 'eligible')

    def test_skill_arrays_are_not_guessed_as_all_or_any(self):
        result = self.invoke(self.rule('skill', ['Python', 'R']), {'skills': ['Python']}, reviewed=True)
        self.assertEqual(result['eligibility']['status'], 'needs_verification')

    def test_pending_enum_requires_explicit_selection(self):
        with self.assertRaises(TypeError):
            match_contract_draft({}, [])
        self.assertEqual(match_contract_draft({}, [], pending_status='needs_confirmation'), {'results': []})


if __name__ == '__main__':
    unittest.main()
