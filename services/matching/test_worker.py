"""Subprocess integration checks; no ports, network or credentials required."""

import base64
import json
from pathlib import Path
import subprocess
import sys
import unittest
from copy import deepcopy

from demo import PROFILES, OPPORTUNITIES
from engine import match
from test_resume import fictional_pdf


class WorkerTests(unittest.TestCase):
    def invoke(self, payload):
        worker = Path(__file__).resolve().parents[1] / 'ai' / 'worker.py'
        process = subprocess.run([sys.executable, '-B', str(worker)],
                                 input=json.dumps(payload), text=True,
                                 capture_output=True, timeout=5)
        return process.returncode, json.loads(process.stdout)

    def test_matching_crosses_process_boundary(self):
        code, result = self.invoke({'operation': 'match', 'profile': next(iter(PROFILES.values())),
                                    'opportunities': OPPORTUNITIES})
        self.assertEqual(code, 0)
        self.assertEqual(result['data']['results'][0]['eligibility_status'], 'ineligible')

    def test_pdf_crosses_process_boundary(self):
        code, result = self.invoke({'operation': 'parse_resume',
                                   'pdf_base64': base64.b64encode(fictional_pdf()).decode()})
        self.assertEqual(code, 0)
        self.assertEqual(result['data']['profile_draft']['skills'], ['Python', 'SQL'])

    def test_invalid_input_returns_error_envelope(self):
        for payload in ([], {'operation': 'missing'}, {'operation': 'parse_resume', 'pdf_base64': '***'},
                        {'operation': 'match', 'profile': {}, 'opportunities': [None]}):
            with self.subTest(payload=payload):
                code, result = self.invoke(payload)
                self.assertEqual(code, 1)
                self.assertEqual(result['error']['code'], 'INVALID_INPUT')

    def test_invalid_education_is_rejected(self):
        with self.assertRaises(ValueError):
            match({'education_level': 'unknown'}, OPPORTUNITIES)

    def test_skill_duplicates_do_not_change_scores(self):
        profile = deepcopy(next(iter(PROFILES.values())))
        original = match(profile, OPPORTUNITIES)
        profile['skills'] = ['Python', 'python', ' PYTHON ']
        self.assertEqual(original['results'][0]['match_score'],
                         match(profile, OPPORTUNITIES)['results'][0]['match_score'])

    def test_invalid_opportunity_types_are_rejected(self):
        for change in ({'description': None}, {'eligibility': None}, {'required_skills': 'Python'}):
            opportunity = {**OPPORTUNITIES[0], **change}
            with self.subTest(change=change), self.assertRaises(ValueError):
                match({}, [opportunity])


if __name__ == '__main__':
    unittest.main()
