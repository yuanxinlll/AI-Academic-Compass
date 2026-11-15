"""Full HTTP handler flows over in-memory streams, with no listening ports."""

import io
import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from demo import OPPORTUNITIES
from server import Handler
from test_resume import fictional_pdf
from test_gemini import result as gemini_result


class MemoryConnection:
    def __init__(self, request):
        self.request = io.BytesIO(request)
        self.response = bytearray()

    def makefile(self, *args):
        return self.request

    def sendall(self, data):
        self.response.extend(data)


def http_request(path, body, content_type='application/json'):
    request = (f'POST {path} HTTP/1.0\r\nHost: localhost\r\n'
               f'Content-Type: {content_type}\r\nContent-Length: {len(body)}\r\n\r\n').encode() + body
    connection = MemoryConnection(request)
    Handler(connection, ('127.0.0.1', 0), SimpleNamespace())
    headers, content = bytes(connection.response).split(b'\r\n\r\n', 1)
    return int(headers.split(b' ')[1]), json.loads(content)


def upload(use_ai=False, pdf=None):
    body = (b'--flow\r\nContent-Disposition: form-data; name="file"; filename="fictional.pdf"\r\n'
            b'Content-Type: application/pdf\r\n\r\n' + (pdf if pdf is not None else fictional_pdf())
            + b'\r\n--flow\r\nContent-Disposition: form-data; name="use_ai"\r\n\r\n'
            + (b'true' if use_ai else b'false') + b'\r\n--flow--\r\n')
    return http_request('/api/resume/parse', body, 'multipart/form-data; boundary=flow')


class EndToEndFlowTests(unittest.TestCase):
    def finish_flow(self, draft):
        status, merged = http_request('/api/profile/merge', json.dumps({
            'confirmed': {'education_level': 'undergraduate', 'weekly_hours_available': 8},
            'draft': draft}).encode())
        self.assertEqual(status, 200)
        self.assertTrue(merged['requires_confirmation'])
        # Simulate explicit student confirmation before requesting matching.
        status, matched = http_request('/api/match', json.dumps({
            'profile': merged['profile_draft'],
            'opportunity_ids': [o['opportunity_id'] for o in OPPORTUNITIES]}).encode())
        self.assertEqual(status, 200)
        self.assertEqual(len(matched['results']), 2)
        self.assertEqual(matched['results'][0]['eligibility_status'], 'ineligible')
        return matched

    @patch('gemini.urlopen', side_effect=AssertionError('Local mode must not call Google.'))
    def test_local_pdf_to_review_to_matching_without_network(self, transport):
        status, parsed = upload()
        self.assertEqual(status, 200)
        self.assertEqual(parsed['parser_mode'], 'labeled_fields_only')
        self.assertEqual(parsed['profile_draft']['skills'], ['Python', 'SQL'])
        self.finish_flow(parsed['profile_draft'])
        transport.assert_not_called()

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'fictional-key', 'GEMINI_MODEL': 'test-model'})
    def test_opted_in_pdf_to_mocked_gemini_to_matching(self):
        value = gemini_result()
        envelope = {'candidates': [{'finishReason': 'STOP', 'content': {
            'parts': [{'text': json.dumps(value)}]}}]}
        with patch('gemini.urlopen', return_value=io.BytesIO(json.dumps(envelope).encode())) as transport:
            status, parsed = upload(use_ai=True)
        self.assertEqual(status, 200)
        self.assertEqual(parsed['parser_mode'], 'gemini')
        self.assertTrue(parsed['requires_confirmation'])
        transport.assert_called_once()
        self.finish_flow(parsed['profile_draft'])

    @patch.dict('os.environ', {}, clear=True)
    def test_opt_in_without_credentials_returns_explicit_error(self):
        status, response = upload(use_ai=True)
        self.assertEqual(status, 503)
        self.assertEqual(response['error']['code'], 'AI_NOT_CONFIGURED')

    def test_invalid_pdf_fails_before_matching(self):
        status, response = upload(pdf=b'not a PDF')
        self.assertEqual(status, 415)
        self.assertEqual(response['error']['code'], 'UNSUPPORTED_FILE_TYPE')

    def test_client_cannot_claim_requirement_review(self):
        status, response = http_request('/api/match', json.dumps({
            'profile': {'education_level': 'undergraduate', 'weekly_hours_available': 12},
            'opportunity_ids': [OPPORTUNITIES[0]['opportunity_id']],
            'reviewed_requirement_ids': [OPPORTUNITIES[0]['opportunity_id']]}).encode())
        self.assertEqual(status, 200)
        self.assertEqual(response['results'][0]['eligibility_status'], 'needs_verification')


if __name__ == '__main__':
    unittest.main()
