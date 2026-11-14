"""Final v1.1 internal service acceptance via ASGI; no sockets or real keys."""

from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app
from demo import OPPORTUNITIES
from test_resume import fictional_pdf


class InternalServiceTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict('os.environ', {'INTERNAL_TOKEN': 'fictional-test-token'})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client = TestClient(app)
        self.headers = {'x-internal-token': 'fictional-test-token'}

    def opportunity(self, requirements=None, status='verified'):
        return {**deepcopy(OPPORTUNITIES[0]), 'status': status, 'eligibility': requirements or []}

    def match(self, opportunity, profile=None):
        return self.client.post('/internal/match', headers=self.headers,
            json={'profile': profile or {}, 'opportunities': [opportunity]})

    def rule(self, kind, value, hard=True):
        return {'type': kind, 'value': value, 'raw_text': 'Fictional requirement.', 'is_hard_requirement': hard}

    def test_missing_and_wrong_tokens_are_rejected(self):
        for headers in ({}, {'x-internal-token': 'wrong'}):
            response = self.client.post('/internal/match', headers=headers, json={})
            self.assertEqual(response.status_code, 401)
            self.assertIn('error', response.json())

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_server_token_fails_closed(self):
        self.assertEqual(self.client.post('/internal/match', json={}).status_code, 503)

    def test_verified_empty_requirements_are_eligible(self):
        result = self.match(self.opportunity()).json()['results'][0]
        self.assertEqual(result['eligibility']['status'], 'eligible')
        self.assertIsNone(result['relevance_score'])

    def test_unverified_and_expired_are_not_eligible(self):
        for status in ('needs_verification', 'expired'):
            result = self.match(self.opportunity(status=status)).json()['results'][0]
            self.assertEqual(result['eligibility']['status'], 'needs_confirmation')

    def test_explicit_failure_precedes_verification_gate(self):
        result = self.match(self.opportunity([self.rule('hours_per_week', 10)], 'needs_verification'),
                            {'hours_per_week': 8}).json()['results'][0]
        self.assertEqual(result['eligibility']['status'], 'ineligible')
        self.assertIn('raw_text', result['eligibility']['checks'][0])

    def test_student_empty_arrays_are_unknown(self):
        result = self.match(self.opportunity([self.rule('skill', 'Python')]), {'skills': []}).json()['results'][0]
        self.assertEqual(result['eligibility']['status'], 'needs_confirmation')

    def test_preference_does_not_disqualify(self):
        result = self.match(self.opportunity([self.rule('skill', 'Python', False)]), {'skills': ['R']}).json()['results'][0]
        self.assertEqual(result['eligibility']['status'], 'eligible')

    def test_null_arrays_and_malformed_requests_are_rejected(self):
        for payload in ({'profile': {'skills': None}, 'opportunities': []}, [], {}):
            response = self.client.post('/internal/match', headers=self.headers, json=payload)
            self.assertEqual(response.status_code, 400)

    @patch('gemini.urlopen', side_effect=AssertionError('Unexpected provider request'))
    def test_local_multipart_resume_returns_only_extracted(self, provider):
        response = self.client.post('/internal/resume/parse', headers=self.headers,
            files={'file': ('fictional.pdf', fictional_pdf(), 'application/pdf')}, data={'use_ai': 'false'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {'extracted'})
        self.assertEqual(response.json()['extracted']['skills'], ['Python', 'SQL'])
        self.assertNotIn('interests', response.json()['extracted'])
        provider.assert_not_called()

    def test_resume_size_limit_and_invalid_file(self):
        for content, expected in ((b'x' * (4 * 1024 * 1024 + 1), 413), (b'bad', 415)):
            response = self.client.post('/internal/resume/parse', headers=self.headers,
                files={'file': ('fictional.pdf', content, 'application/pdf')})
            self.assertEqual(response.status_code, expected)

    def test_file_above_old_two_mb_limit_reaches_pdf_validation(self):
        content = b'%PDF-invalid' + b' ' * (2 * 1024 * 1024)
        response = self.client.post('/internal/resume/parse', headers=self.headers,
            files={'file': ('fictional.pdf', content, 'application/pdf')})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()['error']['code'], 'INVALID_PDF')

    @patch.dict('os.environ', {'GEMINI_API_KEY': '', 'GEMINI_MODEL': ''})
    def test_ai_opt_in_requires_configuration(self):
        response = self.client.post('/internal/resume/parse', headers=self.headers,
            files={'file': ('fictional.pdf', fictional_pdf(), 'application/pdf')}, data={'use_ai': 'true'})
        self.assertEqual(response.status_code, 503)

    def test_unknown_route_uses_contract_error_shape(self):
        response = self.client.get('/internal/missing', headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error']['code'], 'NOT_FOUND')

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'fictional-key', 'GEMINI_MODEL': 'test-model'})
    def test_ai_upload_returns_contract_fields(self):
        import io
        import json
        from test_gemini import result
        envelope = {'candidates': [{'finishReason': 'STOP', 'content': {
            'parts': [{'text': json.dumps(result())}]}}]}
        with patch('gemini.urlopen', return_value=io.BytesIO(json.dumps(envelope).encode())):
            response = self.client.post('/internal/resume/parse', headers=self.headers,
                files={'file': ('fictional.pdf', fictional_pdf(), 'application/pdf')}, data={'use_ai': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'extracted': {'skills': ['Python']}})


if __name__ == '__main__':
    unittest.main()
