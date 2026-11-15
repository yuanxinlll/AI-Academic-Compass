import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from collector.ingest import ApiStore, IngestError, NoRedirect
from collector.pipeline import run_collection

URL = 'https://example.ucsd.edu/opening'
ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ITEM = dict(title='Synthetic opening', category='research', university='UCSD',
            organization=None, description=None, required_skills=[], eligibility=[],
            deadline=None, deadline_text=None, application_method=None, source_url=URL,
            status='needs_verification', opportunity_id='local-id', source_id='local-source',
            first_collected_at='2026-01-01T00:00:00Z', last_verified_at='2026-01-01T00:00:00Z')


def result(size=1):
    return dict(inserted=size, updated=0, duplicates=0, rejected=0, errors=[],
                saved=[dict(index=i, opportunity_id=ID, action='inserted') for i in range(size)])


class IngestTests(unittest.TestCase):
    def store(self):
        return ApiStore(admin_token='private-test-token', source_type='lab_page')

    def test_wire_request_strips_system_fields_and_maps_backend_id(self):
        store = self.store()
        store.opener = Mock()
        store.opener.open.return_value = io.BytesIO(json.dumps(result()).encode())
        record = dict(ITEM)
        counts = store.save_page(URL, [record], '', [])
        request = store.opener.open.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.get_header('X-admin-token'), 'private-test-token')
        self.assertEqual(body['source']['source_type'], 'lab_page')
        for key in ('opportunity_id', 'source_id', 'first_collected_at', 'last_verified_at'):
            self.assertNotIn(key, body['opportunities'][0])
        self.assertEqual(record['opportunity_id'], ID)
        self.assertEqual(counts['inserted'], 1)

    def test_partial_rejections_do_not_hide_saved_records_or_echo_server_text(self):
        store = self.store()
        response = dict(inserted=1, updated=0, duplicates=0, rejected=1,
                        errors=[dict(index=1, message='private-test-token')], saved=result()['saved'])
        store._post = Mock(return_value=response)
        rows = [dict(ITEM), dict(ITEM)]
        counts = store.save_page(URL, rows, '', [])
        self.assertEqual(counts['inserted'], 1)
        self.assertEqual(counts['rejected'], 1)
        self.assertEqual(rows[0]['opportunity_id'], ID)
        self.assertNotIn('private-test-token', json.dumps(counts))

    def test_empty_or_failed_sources_are_local_only(self):
        store = self.store()
        store._post = Mock()
        for records, errors in [([], []), ([], [{'code': 'network_error'}])]:
            self.assertTrue(store.save_page(URL, records, '', errors)['warnings'])
        store._post.assert_not_called()

    def test_batches_respect_backend_limit(self):
        store = self.store()
        store._post = Mock(side_effect=lambda payload: result(len(payload['opportunities'])))
        counts = store.save_page(URL, [dict(ITEM) for _ in range(51)], '', [])
        self.assertEqual(counts['inserted'], 51)
        self.assertEqual([len(c.args[0]['opportunities']) for c in store._post.call_args_list], [50, 1])

    def test_requires_https_origin_and_token(self):
        for url in ('http://example.com', 'https://user:password@example.com',
                    'https://example.com/path', 'https://example.com?x=1'):
            with self.assertRaises(ValueError):
                ApiStore(url, admin_token='token')
        with self.assertRaises(ValueError):
            ApiStore(admin_token='')

    def test_auth_failure_is_not_retried_and_secrets_are_not_reported(self):
        store = self.store()
        store.opener = Mock()
        store.opener.open.side_effect = HTTPError(store.endpoint, 401, 'private-test-token', {}, io.BytesIO())
        with self.assertRaises(IngestError) as caught:
            store.save_page(URL, [dict(ITEM)], '', [])
        self.assertEqual(str(caught.exception), 'ingest_http_401')
        self.assertEqual(store.opener.open.call_count, 1)

    def test_transient_failure_retries_url_upsert(self):
        store = self.store()
        store.opener = Mock()
        store.opener.open.side_effect = [URLError('private-test-token'), io.BytesIO(json.dumps(result()).encode())]
        with patch('collector.ingest.time.sleep'):
            self.assertEqual(store.save_page(URL, [dict(ITEM)], '', [])['inserted'], 1)
        self.assertEqual(store.opener.open.call_count, 2)

    def test_invalid_result_is_not_reported_as_success(self):
        for response in ({}, dict(result(), saved=[]), dict(result(), saved=[dict(index=3, opportunity_id=ID, action='inserted')])):
            with self.assertRaises(IngestError):
                ApiStore._validate_result(response, 1)

    def test_redirects_never_forward_credentials(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 307, '', {}, 'https://other.test'))

    def test_pipeline_uses_api_without_database_and_reports_failed_post(self):
        with tempfile.TemporaryDirectory() as directory:
            store = self.store()
            store._post = Mock(return_value=result())
            path = Path(directory)
            kwargs = dict(database=store, fetcher=lambda url: '<h1>Synthetic opening</h1>',
                          extractor=lambda page, **kw: [ITEM], delay=0)
            first = run_collection([URL], path/'state.json', path/'out.json', **kwargs)
            self.assertEqual(first['persistence'], 'admin_api')
            self.assertEqual(first['inserted'], 1)
            self.assertEqual(json.loads((path/'out.json').read_text())[0]['opportunity_id'], ID)
            store._post.side_effect = IngestError('ingest_http_401')
            second = run_collection([URL], path/'state.json', path/'out.json', **kwargs)
            self.assertEqual(second['errors'][0]['code'], 'ingest_http_401')
            self.assertEqual(second['inserted'], 0)
            self.assertEqual(len(json.loads((path/'out.json').read_text())), 1)


if __name__ == '__main__':
    unittest.main()
