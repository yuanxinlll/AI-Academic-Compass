import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import collector.instagram_campaign as campaign
from collector.instagram_campaign import account_handles, plan, prepare
from collector.pipeline import atomic_json


class CampaignTests(unittest.TestCase):
    def test_handles_platform_labels_and_false_social_text(self):
        self.assertEqual(account_handles('Instagram @spie_at_ucsd'),['spie_at_ucsd'])
        self.assertEqual(account_handles('karate_at_ucsd on Instagram'),['karate_at_ucsd'])
        self.assertEqual(account_handles('Username: careersinhealthatucsd Name: Club'),['careersinhealthatucsd'])
        self.assertEqual(account_handles('@oneclub @secondclub'),['oneclub','secondclub'])
        self.assertEqual(account_handles('N/A'),[])
        self.assertEqual(account_handles('Rooted @ UC San Diego'),[])

    def test_coverage_preserves_all_orgs_and_deduplicates_accounts(self):
        rows=[dict(organization='Synthetic '+str(i),directory_url='https://studentorg.ucsd.edu/Home/Details/'+str(i),
                   registration_status='Current',social_media=social,private_member='Must not retain')
              for i,social in enumerate(('@club','club','','LinkedIn: example'))]
        result=plan({'organizations':rows},{'sources':[]})
        self.assertEqual(result['directory_records_checked'],4)
        self.assertEqual(len(result['accounts']),1)
        self.assertEqual(len(result['accounts'][0]['organizations']),2)
        self.assertNotIn('private_member',str(result))

    def test_prepare_rejects_tags_as_authorship_and_deduplicates_collaboration(self):
        accounts=[dict(handle=h,organizations=['Synthetic '+h],evidence=[dict(directory_url='https://studentorg.ucsd.edu/Home/Details/1')]) for h in ('oneclub','secondclub')]
        common=dict(url='https://www.instagram.com/p/ABC/',user_posted='oneclub',coauthor_producers=['secondclub'],description='Workshop',date_posted='2026-11-15T12:00:00Z',photos=[])
        bad=dict(common,url='https://www.instagram.com/p/BAD/',user_posted='unrelated',coauthor_producers=[],tagged_users=[{'username':'oneclub'}],discovery_input={'url':'https://www.instagram.com/oneclub/'})
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory);atomic_json(folder/'plan.json',dict(accounts=accounts))
            atomic_json(folder/'batch-0-posts.json',[dict(common,discovery_input={'url':'https://www.instagram.com/'+h+'/'}) for h in ('oneclub','secondclub')]+[bad])
            posts,catalog=prepare(folder)
            self.assertEqual(len(posts),1)
            self.assertEqual(len(catalog['sources']),2)

    def test_website_target_caps_writes_and_resume_does_not_reanalyze(self):
        posts=[dict(source_url='https://www.instagram.com/p/'+code+'/',verified_source_account='club',caption='Workshop November 20',posted_at='2026-11-15T12:00:00Z',image_count=0,raw={'code':code},directory_url='https://studentorg.ucsd.edu/Home/Details/1') for code in ('ONE','TWO')]
        class FakeStore:
            calls=0
            def __init__(self,*args,**kwargs):pass
            def save_page(self,url,records,*args):
                self.calls+=1;records[0]['opportunity_id']='saved-'+str(self.calls)
                return dict(inserted=1,updated=0,duplicates=0,rejected=0,errors=[])
        fake_store=FakeStore()
        def analyze(rows,handle,directory,**kwargs):
            code=rows[0]['code']
            record=dict(title=code,source_url='https://www.instagram.com/p/'+code+'/',status='needs_verification',category='event',organization='Club',description=code,deadline=None,eligibility=[],required_skills=[])
            atomic_json(directory/'opportunities.json',[record])
            return dict(posts_checked=1,posts=[dict(source_url=record['source_url'],outcome='collected')],errors=[])
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            atomic_json(folder/'baseline-api.json',dict(total=49,items=[dict(source_url='https://example.test/'+str(i)) for i in range(49)]))
            atomic_json(folder/'normalized-posts.json',posts)
            atomic_json(folder/'account-results.json',[])
            with patch.object(campaign,'prepare',return_value=(posts,{})),patch.object(campaign,'ApiStore',return_value=fake_store),patch.object(campaign,'run_posts',side_effect=analyze) as runner:
                first=campaign.collect(50,folder,workers=2)
                self.assertEqual(fake_store.calls,1)
                self.assertEqual(first['current_ingested'],1)
                count=runner.call_count
                campaign.collect(50,folder,workers=2)
                self.assertEqual(runner.call_count,count)
                self.assertEqual(fake_store.calls,1)
