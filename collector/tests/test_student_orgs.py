import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from collector.source_policy import approved_org_url
from collector.student_orgs import parse_directory, parse_record
from collector.org_verification import inspect, match_organization
from collector.registry import run_registry
from collector.pipeline import run_collection


def catalog(host='club.example', prefix='/'):
    return {'sources':[{'verification_status':'verified_ucsd_affiliated_source',
                       'kind':'website','fetch_enabled':True,
                       'approved_scopes':[{'hostname':host,'path_prefix':prefix}]}]}


class StudentOrgTests(unittest.TestCase):
    def test_scope_is_exact_host_not_suffix_or_another_site(self):
        data=catalog()
        self.assertTrue(approved_org_url('https://club.example/events/a',data))
        for url in ['https://club.example.evil.test/a','https://other.club.example/a',
                    'http://club.example/a','https://user:pass@club.example/a']:
            self.assertFalse(approved_org_url(url,data))

    def test_shared_host_scope_cannot_escape_organization_path(self):
        data=catalog('sites.google.com','/ucsd.edu/club')
        self.assertTrue(approved_org_url('https://sites.google.com/ucsd.edu/club/event',data))
        for path in ['/ucsd.edu/club-other','/ucsd.edu/other','/ucsd.edu/club/%2e%2e/other',
                     '/ucsd.edu/club/%252e%252e/other']:
            self.assertFalse(approved_org_url('https://sites.google.com'+path,data))
        self.assertFalse(approved_org_url('https://sites.google.com/other',catalog('sites.google.com')))

    def test_affiliation_alone_does_not_enable_fetch_or_instagram(self):
        data=catalog()
        data['sources'][0]['fetch_enabled']=False
        self.assertFalse(approved_org_url('https://club.example/',data))
        data=catalog('www.instagram.com','/club')
        data['sources'][0]['kind']='instagram'
        self.assertFalse(approved_org_url('https://www.instagram.com/club/',data))

    def test_directory_parser_uses_current_detail_links(self):
        rows=parse_directory('<a href="/Home/Details/123">A &amp; B</a>'
                             '<a href="/Home/DetailsPrevious/12">Old</a>')
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['organization'],'A & B')

    def test_record_parser_does_not_retain_member_or_email_information(self):
        html='<dt>Academic Year</dt><dd>2026</dd><dt>Status</dt><dd>Current</dd>'
        html+='<dt>Social Media</dt><dd>@club</dd><dt>Organization Email</dt><dd>private@example.com</dd>'
        html+='<table><td>Student Name</td><td>student@example.com</td></table>'
        record=parse_record(html,{'organization':'Club','directory_url':'https://studentorg.ucsd.edu/Home/Details/1'})
        self.assertEqual(record['social_media'],'@club')
        self.assertNotIn('example.com',json.dumps(record))
        self.assertNotIn('Student Name',json.dumps(record))

    def test_similarly_named_organizations_do_not_establish_identity(self):
        orgs=[{'organization':'MAE Graduate Student Council'}, {'organization':'TEDx@UCSanDiego'}]
        self.assertIsNone(match_organization('ECE Undergraduate Student Council',orgs))
        self.assertIsNone(match_organization('Ascend UC San Diego',orgs))

    def test_working_response_does_not_verify_offline_or_login_page(self):
        source={'url':'https://club.example/','kind':'website','organization':'Club',
                'verification_status':'pending','fetch_enabled':False}
        response=io.BytesIO(b'<title>Temporarily Offline</title><p>UCSD club temporarily offline</p>')
        response.url='https://club.example/'
        response.status=200
        with patch('collector.org_verification.urlopen',return_value=response):
            row=inspect(source)
        self.assertFalse(row['fetch_enabled'])
        self.assertEqual(row['verification_status'],'pending')

    def test_revoked_organization_is_retained_disabled_not_fetched(self):
        from collector.registry import load_registry
        source=dict(url='https://unapproved-club.example/',discovery_groups=['event'],
                    role='directory',stage='seed',source_type='listing',enabled=False,
                    provenance=[],source_family='student_orgs')
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'registry.json'
            path.write_text(json.dumps({'version':1,'sources':[source]}))
            registry=load_registry(path)
            self.assertFalse(registry['sources'][0]['enabled'])
            report=run_registry(registry,directory,['event'],source_family='student_orgs')
            self.assertEqual(report['groups']['event']['coverage_gap'],'no_enabled_sources')

    def test_directory_rotation_leaves_budget_for_child_pages(self):
        rows=[]
        for index in (1,2):
            rows.append(dict(url=f'https://example.ucsd.edu/events{index}/',
                        discovery_groups=['event'],role='directory',stage='seed',source_type='listing',
                        enabled=True,provenance=[],source_family='student_orgs'))
        data={'version':1,'sources':rows,'external_candidates':[]}
        def runner(*args,**kwargs):
            return run_collection(*args,**kwargs,fetcher=lambda url:'<a href="workshop">Workshop</a>',
                                  extractor=lambda page,**kw:[],delay=0)
        with tempfile.TemporaryDirectory() as directory:
            first=run_registry(data,directory,['event'],2,runner=runner,source_family='student_orgs')
            second=run_registry(data,directory,['event'],2,runner=runner,source_family='student_orgs')
        self.assertEqual(first['groups']['event']['available_seed_count'],2)
        self.assertNotEqual(first['groups']['event']['seed_urls'],second['groups']['event']['seed_urls'])
        self.assertEqual(first['groups']['event']['websites_checked'],2)


if __name__=='__main__':
    unittest.main()
