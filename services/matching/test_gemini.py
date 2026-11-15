"""Mocked Gemini contract checks; no real requests or credentials."""

import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import server
from gemini import FIELDS, GeminiError, parse_text, validate_output


def result():
    return {"profile_draft": {key: ["Python"] if key == "skills" else None
                              for key in FIELDS},
            "evidence": [{"field": "skills", "source_text": "Skills: Python"}]}


class GeminiTests(unittest.TestCase):
    def test_grounded_draft_requires_confirmation(self):
        value = validate_output(result(), "Skills: Python")
        self.assertTrue(value["requires_confirmation"])

    def test_hallucinated_evidence_is_rejected(self):
        with self.assertRaises(GeminiError):
            validate_output(result(), "No skills supplied.")

    def test_missing_evidence_and_bad_types_are_rejected(self):
        for mutate in (
                lambda v: v.update(evidence=[]),
                lambda v: v['profile_draft'].update(academic_year=True),
                lambda v: v['profile_draft'].update(skills="Python"),
                lambda v: v['profile_draft'].update(unexpected="value")):
            value = result()
            mutate(value)
            with self.assertRaises(GeminiError):
                validate_output(value, "Skills: Python")

    @patch.dict('os.environ', {}, clear=True)
    def test_unconfigured_adapter_never_calls_transport(self):
        with self.assertRaises(GeminiError) as caught:
            parse_text("Skills: Python", transport=lambda *a, **k: self.fail("Unexpected request"))
        self.assertEqual(caught.exception.code, 'AI_NOT_CONFIGURED')

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'fictional-test-key', 'GEMINI_MODEL': 'test-model'})
    def test_request_contract_and_valid_response(self):
        def transport(request, timeout):
            self.assertEqual(timeout, 30)
            self.assertNotIn('fictional-test-key', request.full_url)
            payload = json.loads(request.data)
            self.assertEqual(payload['generationConfig']['responseMimeType'], 'application/json')
            return io.BytesIO(json.dumps({'candidates': [{'finishReason': 'STOP', 'content': {
                'parts': [{'text': json.dumps(result())}]}}]}).encode())
        self.assertEqual(parse_text('Skills: Python', transport)['parser_mode'], 'gemini')

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'fictional-test-key', 'GEMINI_MODEL': 'test-model'})
    def test_provider_errors_are_sanitized(self):
        for error, code in (
                (HTTPError('url', 403, 'secret', {}, None), 'AI_ACCESS_DENIED'),
                (HTTPError('url', 429, 'secret', {}, None), 'AI_RATE_LIMITED'),
                (URLError('secret'), 'AI_SERVICE_UNAVAILABLE')):
            def transport(*args, **kwargs):
                raise error
            with self.assertRaises(GeminiError) as caught:
                parse_text('Skills: Python', transport)
            self.assertEqual(caught.exception.code, code)
            self.assertNotIn('secret', str(caught.exception))

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'fictional-test-key', 'GEMINI_MODEL': 'test-model'})
    def test_blocked_or_invalid_response_is_rejected(self):
        for value in ({'candidates': []}, {'candidates': [{'finishReason': 'MAX_TOKENS'}]}):
            with self.assertRaises(GeminiError):
                parse_text('Skills: Python', lambda *a, **k: io.BytesIO(json.dumps(value).encode()))


if __name__ == '__main__':
    unittest.main()
