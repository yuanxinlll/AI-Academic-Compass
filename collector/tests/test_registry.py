import copy
import json
import tempfile
import unittest
from pathlib import Path

from collector.main import normalize
from collector.pipeline import run_collection
from collector.registry import DiscoveryPolicy, export_lists, load_registry, run_registry

ROOT_URL = 'https://example.ucsd.edu/internships/'
DETAIL = ROOT_URL + 'credit-program'
ITEM = dict(title='Academic credit program', category='program', description=None,
            required_skills=[], eligibility=[], deadline=None)


def seed(url=ROOT_URL, group='internship'):
    return dict(url=url, discovery_groups=[group], role='directory', stage='seed',
                source_type='listing', enabled=True, notes='', provenance=[])


def data():
    return dict(version=1, sources=[seed()], external_candidates=[])


class RegistryTests(unittest.TestCase):
    def test_validation_rejects_duplicates_and_unrecognized_groups(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'registry.json'
            for invalid in [dict(data(), sources=[seed(), seed()]),
                            dict(data(), sources=[dict(seed(), discovery_groups=['made_up'])])]:
                path.write_text(json.dumps(invalid))
                with self.assertRaises(ValueError):
                    load_registry(path)

    def test_directory_is_not_extracted_and_discovered_page_retains_real_category(self):
        registry = data()
        called = []
        def fetch(url):
            called.append(url)
            return '<a href="credit-program">Credit internship program</a>' if url == ROOT_URL else '<h1>Academic credit program</h1>'
        def runner(*args, **kwargs):
            return run_collection(*args, **kwargs, fetcher=fetch,
                                  extractor=lambda page, **kw: [ITEM], delay=0)
        with tempfile.TemporaryDirectory() as directory:
            report = run_registry(registry, directory, ['internship'], 2, runner=runner)
            self.assertEqual(called, [ROOT_URL, DETAIL])
            self.assertEqual(report['record_categories'], {'program': 1})
            self.assertEqual(registry['sources'][1]['stage'], 'collected')
            self.assertEqual(registry['sources'][1]['provenance'][0]['source_url'], ROOT_URL)
            self.assertEqual(report['groups']['internship']['observed_record_categories'], {'program': 1})

    def test_each_group_has_its_own_budget(self):
        registry = data()
        registry['sources'].append(seed('https://example.ucsd.edu/events/', 'event'))
        visited = []
        def fetch(url):
            visited.append(url)
            return '<a href="workshop-one">Workshop</a><a href="workshop-two">Workshop</a><a href="internship-one">Internship</a>'
        def runner(*args, **kwargs):
            return run_collection(*args, **kwargs, fetcher=fetch, extractor=lambda page, **kw: [], delay=0)
        with tempfile.TemporaryDirectory() as directory:
            report = run_registry(registry, directory, ['internship', 'event'], 2, runner=runner)
        self.assertEqual(report['groups']['internship']['websites_checked'], 2)
        self.assertEqual(report['groups']['event']['websites_checked'], 2)
        self.assertEqual(len(visited), 4)

    def test_group_ranking_ignores_research_nav_and_preserves_external_queue(self):
        registry = data()
        policy = DiscoveryPolicy(registry, 'event')
        links = ['https://example.ucsd.edu/research/join', 'https://example.ucsd.edu/event/workshop-data',
                 'https://example.ucsd.edu/event/soccer', 'https://example.ucsd.edu/login']
        selected = policy.links('<a href="https://employer.example/internship">Employer</a>', ROOT_URL, links)
        self.assertEqual(selected, ['https://example.ucsd.edu/event/workshop-data'])
        self.assertEqual(registry['external_candidates'][0]['discovered_from'], ROOT_URL)
        self.assertEqual(registry['external_candidates'][0]['status'], 'needs_review')
        self.assertNotIn('https://employer.example/internship', [s['url'] for s in registry['sources']])

    def test_candidate_does_not_become_verified_or_monitor_enabled_by_discovery_alone(self):
        registry = data()
        policy = DiscoveryPolicy(registry, 'internship')
        policy.links('', ROOT_URL, [DETAIL])
        candidate = registry['sources'][1]
        self.assertEqual(candidate['stage'], 'candidate')
        self.assertFalse(candidate['enabled'])
        with tempfile.TemporaryDirectory() as directory:
            report = run_registry(registry, directory, ['internship'], mode='monitor')
        self.assertEqual(report['groups']['internship']['coverage_gap'], 'no_enabled_sources')

    def test_legacy_lists_are_generated_from_registry(self):
        registry = data()
        registry['sources'].append(dict(seed(DETAIL), role='detail', stage='source_reviewed'))
        with tempfile.TemporaryDirectory() as directory:
            export_lists(registry, directory)
            self.assertEqual(json.loads((Path(directory)/'sources.json').read_text()), [ROOT_URL])
            self.assertEqual(json.loads((Path(directory)/'reviewed_sources.json').read_text()), [DETAIL])

    def test_explicit_past_activity_end_expires_without_inventing_deadline(self):
        item = dict(ITEM, category='event', activity_end_date='2020-01-02', activity_end_text='January 2, 2020')
        row = normalize([item], DETAIL, 'Workshop ends January 2, 2020.')[0]
        self.assertEqual(row['status'], 'expired')
        self.assertIsNone(row['deadline'])
        self.assertNotIn('activity_end_date', row)
        with self.assertRaises(ValueError):
            normalize([item], DETAIL, 'No stated date.')

    def test_confirmation_actions_and_malformed_hrefs_are_not_crawled(self):
        from collector.text import parse_page
        _, links = parse_page('<a href="/event/a/confirm?return=home">Confirm</a>'
                              '<a href="/training/this is prose">Broken</a>'
                              '<a href="/event/workshop">Workshop</a>', ROOT_URL)
        self.assertFalse(any('prose' in url for url in links))
        selected = DiscoveryPolicy(data(), 'event').links('', ROOT_URL, links)
        self.assertEqual(selected, ['https://example.ucsd.edu/event/workshop'])

    def test_research_program_details_outrank_mentor_navigation(self):
        policy = DiscoveryPolicy(data(), 'research')
        urls = ['https://example.ucsd.edu/research-mentors/be-a-mentor.html',
                'https://example.ucsd.edu/programs/all-urh-programs/fmp/index.html']
        self.assertEqual(policy.links('', ROOT_URL, urls), [urls[1]])

    def test_bad_group_or_budget_never_calls_provider(self):
        with self.assertRaises(ValueError):
            run_registry(data(), '.', ['made_up'])
        with self.assertRaises(ValueError):
            run_registry(data(), '.', ['event'], 101)


if __name__ == '__main__':
    unittest.main()
