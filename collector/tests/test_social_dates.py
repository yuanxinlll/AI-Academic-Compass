import unittest
from collector.social_dates import resolve_yearless, apply_policy


class SocialDateTests(unittest.TestCase):
    def test_post_year_and_december_rollover(self):
        self.assertEqual(resolve_yearless('11/26', '2026-11-09T23:52:32Z')['date'], '2026-11-26')
        self.assertEqual(resolve_yearless('January 4 8 PM', '2026-12-20T12:00:00Z')['date'], '2027-01-04')

    def test_anchor_is_post_date_not_collection_date(self):
        self.assertEqual(resolve_yearless('11/26', '2020-11-09T12:00:00Z')['date'], '2020-11-26')
        self.assertEqual(resolve_yearless('November 12', '2026-11-13T00:30:00Z')['date'], '2026-11-12')

    def test_yearless_event_range_uses_printed_end(self):
        self.assertEqual(resolve_yearless('January 16-17', '2026-12-20T12:00:00Z')['date'], '2027-01-17')

    def test_explicit_year_missing_timestamp_and_ambiguity(self):
        for text, posted in [('11/26/2026', '2026-11-09T12:00:00Z'), ('11/26', None),
                             ('11/26', '2026-11-09'), ('11/26 and 12/01', '2026-11-09T12:00:00Z'),
                             ('February 30', '2026-11-09T12:00:00Z')]:
            self.assertIsNone(resolve_yearless(text, posted))

    def test_leap_day_and_printed_time_preserved(self):
        result=resolve_yearless('February 29 8:30 PM PST', '2026-11-09T12:00:00Z')
        self.assertEqual(result['date'], '2028-02-29')
        self.assertIn('8:30 PM PST', result['raw_text'])

    def test_explicit_support_wins_and_unsupported_quote_does_not_infer(self):
        record=dict(deadline='2027-11-26',deadline_text='11/26',description='Description')
        self.assertEqual(apply_policy([record],[{}],'11/26','2026-11-09T12:00:00Z',None),[])
        record['deadline']=None
        self.assertEqual(apply_policy([record],[{}],'nothing','2026-11-09T12:00:00Z',None),[])

    def test_yearless_event_evidence_is_retained(self):
        record=dict(deadline=None,deadline_text=None,description=None)
        items=[dict(activity_end_text='November 12 8-9:50PM')]
        result=apply_policy([record],items,'November 12 8-9:50PM','2026-11-12T00:07:26Z',None)
        self.assertEqual(result[0]['date'],'2026-11-12')
        self.assertEqual(result[0]['basis'],'inferred_year')
        self.assertIsNone(record['deadline'])
