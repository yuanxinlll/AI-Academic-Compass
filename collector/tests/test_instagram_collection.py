import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from collector.instagram_collection import media_url,run_posts
from collector.main import normalize

URL='https://www.instagram.com/p/ABC123/'
CAPTION='Applications live. Priority deadline: 11/26. Python required.'
ITEM=dict(title='Synthetic Hackathon',university='UCSD',organization='Synthetic Club',category='competition',
          description='A synthetic competition.',required_skills=['Python'],eligibility=[dict(type='skill',
          value='Python',raw_text='Python required.',is_hard_requirement=True)],deadline=None,
          deadline_text='Priority deadline: 11/26.',application_method='Link in bio')
CATALOG={'sources':[dict(kind='instagram',url='https://www.instagram.com/club/',registration_status='Current',
                        directory_url='https://studentorg.ucsd.edu/Home/Details/1',affiliation_evidence=['UCSD'])]}


def row(url=URL,caption=CAPTION):
    return dict(url=url,user_posted='club',description=caption,coauthor_producers=[],
                date_posted='2026-11-12T00:00:00Z',photos=['https://scontent.example.cdninstagram.com/image.jpg'])


class Store:
    def __init__(self):self.calls=[]
    def save_page(self,url,records,checked_at,errors):
        self.calls.append((url,records))
        records[0]['opportunity_id']='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        return dict(inserted=int(len(self.calls)==1),updated=int(len(self.calls)>1),duplicates=0,rejected=0,errors=[])


class InstagramCollectionTests(unittest.TestCase):
    def run_pipeline(self,folder,rows=None,items=None,store=None,support=None,extractor=None):
        return run_posts(rows or [row()],'club',folder,catalog=CATALOG,store=store,
                         image_loader=lambda url,path:(b'fake image','image/jpeg'),
                         ocr=lambda data,mime:'APPLICATIONS LIVE priority deadline: 11/26',
                         support_loader=lambda caption,folder:support,
                         extractor=extractor or (lambda text,**kw:items if items is not None else [dict(ITEM)]))

    def test_image_caption_validation_to_api_without_global_instagram_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            store=Store();report=self.run_pipeline(directory,store=store)
            self.assertFalse(report['errors'])
            self.assertEqual(report['inserted'],1)
            saved=json.loads((Path(directory)/'opportunities.json').read_text())[0]
            self.assertEqual(saved['deadline'],'2026-11-26')
            self.assertIn('year inferred',saved['description'])
            self.assertEqual(saved['source_url'],URL)
            self.assertTrue(saved['opportunity_id'])
        with self.assertRaises(ValueError):normalize([ITEM],URL,CAPTION)

    def test_explicit_range_end_is_valid_but_unrelated_deadline_year_is_not(self):
        from datetime import date
        from collector.validation import date_in_evidence
        self.assertTrue(date_in_evidence(date(2027,1,17),'January 16-17, 2027'))
        self.assertTrue(date_in_evidence(date(2027,1,16),'January 16\u201317, 2027'))
        self.assertFalse(date_in_evidence(date(2027,11,26),'January 16-17, 2027. Apply by 11/26'))
        self.assertFalse(date_in_evidence(date(2027,1,17),'January 17-16, 2027'))

    def test_invented_deadline_year_is_not_sent_to_api(self):
        with tempfile.TemporaryDirectory() as directory:
            store=Store()
            report=self.run_pipeline(directory,items=[dict(ITEM,deadline='2026-11-26')],store=store)
            self.assertTrue(report['errors'])
            self.assertFalse(store.calls)

    def test_past_recap_skips_images_and_api(self):
        with tempfile.TemporaryDirectory() as directory:
            media=Mock(side_effect=AssertionError('Recap must not fetch images'))
            store=Store()
            report=run_posts([row(caption='We hosted our largest event this past weekend! Thank you!')],
                             'club',directory,catalog=CATALOG,store=store,image_loader=media)
            self.assertEqual(report['skipped_recaps'],1)
            self.assertFalse(store.calls)

    def test_published_event_end_marks_expired_without_changing_deadline(self):
        support={'source_url':'https://luma.com/12345678','event':{'name':'Workshop',
                 'startDate':'2020-01-02T20:00:00-08:00','endDate':'2020-01-02T21:00:00-08:00'}}
        item=dict(ITEM,category='event',deadline_text=None)
        with tempfile.TemporaryDirectory() as directory:
            report=self.run_pipeline(directory,items=[item],support=support)
            self.assertFalse(report['errors'])
            record=json.loads((Path(directory)/'opportunities.json').read_text())[0]
            self.assertEqual(record['status'],'expired')
            self.assertIsNone(record['deadline'])

    def test_yearless_event_stays_in_review_on_repeated_runs(self):
        item=dict(ITEM,category='event',deadline_text=None)
        with tempfile.TemporaryDirectory() as directory:
            store=Store()
            for _ in range(2):
                report=self.run_pipeline(directory,items=[item],store=store)
                self.assertEqual(report['held_for_date_review'],1)
            self.assertFalse(store.calls)

    def test_unrelated_year_does_not_confirm_event_date(self):
        item=dict(ITEM,category='event',deadline_text=None)
        caption=CAPTION+' Workshop November 12. Club founded in 2020.'
        with tempfile.TemporaryDirectory() as directory:
            store=Store()
            report=self.run_pipeline(directory,rows=[row(caption=caption)],items=[item],store=store)
            self.assertEqual(report['held_for_date_review'],1)
            self.assertFalse(store.calls)

    def test_unsupported_eligibility_is_rejected(self):
        item=dict(ITEM,eligibility=[dict(type='gpa',value=4,raw_text='GPA 4.0 required',is_hard_requirement=True)])
        with tempfile.TemporaryDirectory() as directory:
            report=self.run_pipeline(directory,items=[item])
            self.assertTrue(report['errors'])
            self.assertEqual(report['records_found'],0)

    def test_cached_extraction_reuses_validation_and_stable_post_identity(self):
        extract=Mock(side_effect=lambda text,**kw:[dict(ITEM)])
        with tempfile.TemporaryDirectory() as directory:
            store=Store()
            first=self.run_pipeline(directory,extractor=extract,store=store)
            second=self.run_pipeline(directory,extractor=extract,store=store)
            self.assertEqual(extract.call_count,1)
            self.assertEqual(first['inserted'],1)
            self.assertEqual(second['updated'],1)
            self.assertEqual(store.calls[0][0],store.calls[1][0])

    def test_carousel_over_budget_is_withheld(self):
        post=row();post['photos']=['image']*4
        with tempfile.TemporaryDirectory() as directory:
            store=Store();report=self.run_pipeline(directory,rows=[post],store=store)
            self.assertTrue(report['errors'])
            self.assertFalse(store.calls)

    def test_non_cdn_or_insecure_media_is_not_downloadable(self):
        for url in ('http://scontent.cdninstagram.com/a.jpg','https://127.0.0.1/a.jpg',
                    'https://cdninstagram.com.evil.test/a.jpg','https://user:pass@scontent.cdninstagram.com/a.jpg'):
            with self.assertRaises(ValueError):media_url(url)

    def test_multiple_opportunities_on_one_post_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            store=Store()
            report=self.run_pipeline(directory,items=[dict(ITEM),dict(ITEM,title='Other role')],store=store)
            self.assertTrue(report['errors'])
            self.assertFalse(store.calls)


if __name__=='__main__':unittest.main()
