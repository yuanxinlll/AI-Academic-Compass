import io
import json
import unittest
from unittest.mock import Mock,patch
from urllib.error import HTTPError

from collector.instagram import InstagramClient,attested_source,clean_posts,profile_handle


def post(actor='club',coauthors=None,url='https://www.instagram.com/p/ABC123/'):
    return dict(user_posted=actor,coauthor_producers=coauthors or [],url=url,
                description='Public workshop announcement.',date_posted='2026-11-12T00:00:00Z',
                photos=['image'],followers=999,tagged_users=['club'])


class InstagramTests(unittest.TestCase):
    def test_primary_and_explicit_coauthor_are_accepted(self):
        for row in [post(),post('partner',['club']),post('partner',[{'username':'club'}])]:
            self.assertEqual(len(clean_posts([row],'club')),1)

    def test_tags_or_discovery_input_are_not_authorship(self):
        row=post('unrelated')
        row['discovery_input']={'url':'https://www.instagram.com/club/'}
        self.assertEqual(clean_posts([row],'club'),[])

    def test_only_public_permalink_and_bounded_result_are_retained(self):
        rows=[post(url='https://www.instagram.com/p/ID'+str(i)+'/') for i in range(5)]
        self.assertEqual(len(clean_posts(rows,'club',3)),3)
        self.assertEqual(clean_posts([post(url='https://evil.example/p/ABC/')],'club'),[])
        self.assertEqual(clean_posts([post(url='https://www.instagram.com/accounts/login/')],'club'),[])
        with self.assertRaises(ValueError):clean_posts(rows,'club',4)

    def test_discard_unused_profile_and_engagement_fields(self):
        row=clean_posts([post()],'club')[0]
        for key in ('followers','tagged_users','likes','num_comments','profile_image_link'):
            self.assertNotIn(key,row)
        self.assertEqual(row['posted_at'],'2026-11-12T00:00:00Z')

    def test_unknown_or_noncurrent_account_is_not_attested(self):
        source=dict(kind='instagram',url='https://www.instagram.com/club/',
                    directory_url='https://studentorg.ucsd.edu/Home/Details/1',
                    registration_status='Current',affiliation_evidence=['https://studentorg.ucsd.edu/'])
        self.assertEqual(attested_source('club',{'sources':[source]}),source)
        with self.assertRaises(ValueError):attested_source('other',{'sources':[source]})
        source['registration_status']='Expired'
        with self.assertRaises(ValueError):attested_source('club',{'sources':[source]})

    def test_trigger_is_bounded_and_not_retried_on_http_failure(self):
        client=InstagramClient('synthetic-key')
        with patch('collector.instagram.urlopen',side_effect=HTTPError('https://api.brightdata.com',400,'secret',{},io.BytesIO())) as opened:
            with self.assertRaisesRegex(RuntimeError,'^instagram_http_400$'):
                client.trigger('club',3)
            self.assertEqual(opened.call_count,1)
            request=opened.call_args.args[0]
            body=json.loads(request.data)
            self.assertEqual(body['limit_per_input'],3)
            self.assertEqual(body['input'][0]['num_of_posts'],3)
            self.assertIn('/trigger?',request.full_url)

    def test_reject_profile_and_snapshot_path_injection(self):
        for value in ('https://evil.example/club','../other','https://www.instagram.com/p/ABC'):
            with self.assertRaises(ValueError):profile_handle(value)
        with self.assertRaises(ValueError):InstagramClient('key').progress('../secret')

    def test_undated_stays_unknown_and_naive_post_time_is_rejected(self):
        row=post();row['date_posted']=None
        self.assertIsNone(clean_posts([row],'club')[0]['posted_at'])
        row['date_posted']='2026-11-12T00:00:00'
        with self.assertRaises(ValueError):clean_posts([row],'club')


if __name__=='__main__':unittest.main()
