import json
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError

from collector.pipeline import run_collection
from collector.text import parse_page, evidence_in
from collector.validation import date_in_evidence
from datetime import date

URL = 'https://example.ucsd.edu/opening'
HTML = '<h1>Test research opening</h1><p>Python required.</p>'
ITEM = dict(title='Test research opening', category='research', description=None,
            required_skills=['Python'], deadline=None, eligibility=[
                dict(type='skill', value='Python', raw_text='Python required.',
                     is_hard_requirement=True)])


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name) / 'state.json'
        self.output = Path(self.temp.name) / 'records.json'

    def run_pipeline(self, fetcher=lambda url: HTML, extractor=lambda page, **kw: [ITEM], **kwargs):
        return run_collection([URL], self.state, self.output, delay=0,
                              fetcher=fetcher, extractor=extractor, **kwargs)

    def test_repeated_fetch_does_not_duplicate_or_reextract(self):
        calls = []
        def extractor(page, **kwargs):
            calls.append(page)
            return [ITEM]
        self.assertEqual(self.run_pipeline(extractor=extractor)['inserted'], 1)
        first = json.loads(self.output.read_text())[0]['first_collected_at']
        self.assertEqual(self.run_pipeline(extractor=extractor)['duplicates'], 1)
        records = json.loads(self.output.read_text())
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['first_collected_at'], first)

    def test_changed_page_reextracts_and_preserves_first_collection(self):
        self.run_pipeline()
        first = json.loads(self.output.read_text())[0]['first_collected_at']
        item = dict(ITEM, description='Updated description')
        result = self.run_pipeline(fetcher=lambda url: HTML + '<p>Updated description</p>',
                                   extractor=lambda page, **kw: [item])
        self.assertEqual(result['updated'], 1)
        self.assertEqual(json.loads(self.output.read_text())[0]['first_collected_at'], first)

    def test_invalid_extraction_preserves_last_good_record(self):
        self.run_pipeline()
        result = self.run_pipeline(fetcher=lambda url: HTML + 'change',
                                   extractor=lambda page, **kw: [dict(ITEM, deadline='bad')])
        self.assertEqual(result['errors'][0]['code'], 'validation_failed')
        self.assertEqual(len(json.loads(self.output.read_text())), 1)

    def test_network_error_is_safe_and_logged(self):
        def fail(url):
            raise HTTPError(url, 429, 'secret provider response', None, None)
        report = self.run_pipeline(fetcher=fail)
        self.assertEqual(report['errors'][0]['code'], 'http_429')
        self.assertNotIn('secret', json.dumps(report))

    def test_discovery_is_bounded_and_deduplicates_urls(self):
        fetched = []
        def fetch(url):
            fetched.append(url)
            return '<a href="/programs/a#top">A</a><a href="/programs/a">A</a><a href="https://evil.test/a">Bad</a>'
        report = self.run_pipeline(fetcher=fetch, extractor=lambda page, **kw: [],
                                   discover=True, max_depth=2, max_pages=2)
        self.assertEqual(len(fetched), 2)
        self.assertEqual(report['pages_retrieved'], 2)
        self.assertTrue(all('evil' not in url for url in fetched))

    def test_invalid_extraction_gets_one_corrective_retry(self):
        calls = []
        def extractor(page, feedback=None):
            calls.append(feedback)
            return [dict(ITEM, eligibility=['invalid'])] if len(calls) == 1 else [ITEM]
        report = self.run_pipeline(extractor=extractor)
        self.assertFalse(report['errors'])
        self.assertEqual(len(calls), 2)
        self.assertIsNotNone(calls[1])

    def test_save_invokes_integration_and_records_errors(self):
        class Store:
            calls = []
            def save_page(self, url, records, checked_at, errors):
                self.calls.append((url, records, errors))
        store = Store()
        self.run_pipeline(database=store)
        self.assertEqual(store.calls[0][0], URL)
        self.assertEqual(len(store.calls[0][1]), 1)
        self.assertEqual(store.calls[0][2], [])

    def test_html_evidence_normalization_without_paraphrasing(self):
        page, links = parse_page('<p>Have a <b>GPA</b> of 2.7&nbsp;or above.</p>'
                                 '<script>ignore()</script>', URL)
        self.assertTrue(evidence_in('Have a GPA of 2.7 or above.', page))
        self.assertFalse(evidence_in('GPA must be at least 3.0', page))
        self.assertNotIn('ignore', page)

    def test_deadline_must_match_entire_date(self):
        expected = date(2026, 12, 18)
        for evidence in ['12/18/2026*', 'December 18, 2026', '2026-12-18']:
            self.assertTrue(date_in_evidence(expected, evidence))
        self.assertFalse(date_in_evidence(expected, '12/04/2026'))
        self.assertFalse(date_in_evidence(expected, 'Applications open in 2026'))

    def test_cross_source_exact_duplicates_are_merged(self):
        item = dict(ITEM, organization='Synthetic lab', description='Same exact opportunity')
        urls = [URL, 'https://example.ucsd.edu/duplicate']
        report = run_collection(urls, self.state, self.output, max_pages=2, delay=0,
                                fetcher=lambda url: HTML,
                                extractor=lambda page, **kw: [item])
        self.assertEqual(len(json.loads(self.output.read_text())), 1)
        self.assertEqual(report['duplicates'], 1)
        self.assertEqual(report['records_found'], 2)

    def test_disappeared_opportunity_is_flagged_not_removed(self):
        self.run_pipeline()
        result = self.run_pipeline(fetcher=lambda url: '<p>No opportunities listed</p>',
                                   extractor=lambda page, **kw: [])
        self.assertTrue(result['errors'])
        records = json.loads(self.output.read_text())
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['status'], 'needs_verification')

    def test_directory_is_never_an_opportunity(self):
        report = run_collection(['https://ugresearch.ucsd.edu/programs/urh-academic-year/index.html'],
                                self.state, self.output, delay=0,
                                fetcher=lambda url: HTML,
                                extractor=lambda page, **kw: [ITEM])
        self.assertEqual(report['records_found'], 0)

    def test_failure_does_not_revive_expired_opportunity(self):
        item = dict(ITEM, closure_evidence='Applications are currently closed.')
        self.run_pipeline(fetcher=lambda url: HTML + '<p>Applications are currently closed.</p>',
                          extractor=lambda page, **kw: [item])
        def fail(url):
            raise OSError('unavailable')
        self.run_pipeline(fetcher=fail)
        self.assertEqual(json.loads(self.output.read_text())[0]['status'], 'expired')
