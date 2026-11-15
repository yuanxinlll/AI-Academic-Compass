import os
import unittest
from unittest.mock import patch
from collector.api import collect_request


class ApiTests(unittest.TestCase):
    def test_unauthorized_never_contacts_database(self):
        with patch.dict(os.environ, {'ADMIN_TOKEN': 'test-token'}):
            body, status = collect_request({'url': 'https://ucsd.edu/'}, 'wrong', store=object())
        self.assertEqual(status, 401)
        self.assertEqual(body['error']['code'], 'UNAUTHORIZED')

    def test_invalid_payloads_are_rejected(self):
        with patch.dict(os.environ, {'ADMIN_TOKEN': 'test-token'}):
            for payload in [{}, {'url': 'https://evil.test/'},
                            {'url': 'https://ucsd.edu/', 'source_id': 'x'}, {'source_id': 'bad'}]:
                body, status = collect_request(payload, 'test-token', store=object())
                self.assertEqual(status, 400)

    def test_collect_returns_agreed_summary(self):
        class Store:
            def check_schema(self): pass
        report = dict(records_found=1, inserted=1, updated=0, duplicates=0,
                      needs_verification=1, errors=[], private_field='hidden')
        with patch.dict(os.environ, {'ADMIN_TOKEN': 'test-token'}):
            with patch('collector.api.run_collection', return_value=report):
                body, status = collect_request({'url': 'https://ucsd.edu/'}, 'test-token', store=Store())
        self.assertEqual(status, 200)
        self.assertEqual(body['inserted'], 1)
        self.assertNotIn('private_field', body)

    def test_source_not_found(self):
        class Store:
            def check_schema(self): pass
            def resolve_source(self, source_id): return None
        with patch.dict(os.environ, {'ADMIN_TOKEN': 'test-token'}):
            body, status = collect_request({'source_id': '00000000-0000-4000-8000-000000000001'},
                                           'test-token', store=Store())
        self.assertEqual(status, 404)
