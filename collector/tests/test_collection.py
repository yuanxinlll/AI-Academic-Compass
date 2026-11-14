import unittest
from collector.main import normalize, validate_url


class CollectionTests(unittest.TestCase):
    def record(self, **changes):
        return dict(title='Research opening', description='Synthetic test listing',
                    category='research', required_skills=[], eligibility=[],
                    deadline=None, **changes)

    def test_duplicates_and_unknown_dates(self):
        result = normalize([self.record(), self.record()], 'https://ucsd.edu/test', '')
        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0]['deadline'])
        self.assertNotIn('opportunity_id', result[0])
        self.assertEqual(result[0]['status'], 'needs_verification')

    def test_unsupported_deadline_rejected(self):
        item = self.record()
        item['deadline'] = '2099-01-01T00:00:00Z'
        with self.assertRaises(ValueError):
            normalize([item], 'https://ucsd.edu/test', '')

    def test_invalid_shapes_rejected(self):
        for item in [self.record(categoryx='invalid'), self.record()]:
            item['required_skills'] = 'Python'
            with self.assertRaises(ValueError):
                normalize([item], 'https://ucsd.edu/test', '')

    def test_structured_eligibility_and_optional_fields(self):
        item = self.record()
        item['description'] = None
        item['eligibility'] = [dict(type='skill', value='Python',
            raw_text='Python required', is_hard_requirement=True)]
        result = normalize([item], 'https://ucsd.edu/test', 'Python required')[0]
        self.assertEqual(result['eligibility'], item['eligibility'])
        self.assertIsNone(result['organization'])
        self.assertIsNone(result['source_id'])
        self.assertIsNone(result['application_method'])
        self.assertIn('first_collected_at', result)

    def test_date_only_and_expiration(self):
        for deadline, status in [('2099-01-01', 'needs_verification'),
                                 ('2000-01-01', 'expired')]:
            item = self.record()
            item.update(deadline=deadline, deadline_text=deadline)
            result = normalize([item], 'https://ucsd.edu/test', deadline)[0]
            self.assertEqual(result['deadline'], deadline)
            self.assertEqual(result['status'], status)

    def test_legacy_eligibility_rejected(self):
        item = self.record()
        item['eligibility'] = ['Python required']
        with self.assertRaises(ValueError):
            normalize([item], 'https://ucsd.edu/test', 'Python required')

    def test_same_url_distinct_opportunities_rejected(self):
        other = self.record()
        other['title'] = 'Another opening'
        with self.assertRaises(ValueError):
            normalize([self.record(), other], 'https://ucsd.edu/test', '')

    def test_timestamp_deadline_rejected(self):
        item = self.record()
        item.update(deadline='2099-01-01T00:00:00Z', deadline_text='2099-01-01T00:00:00Z')
        with self.assertRaises(ValueError):
            normalize([item], 'https://ucsd.edu/test', item['deadline_text'])

    def test_source_boundary(self):
        for url in ['http://ucsd.edu', 'https://ucsd.edu.evil.com', 'https://localhost']:
            with self.assertRaises(ValueError):
                validate_url(url)
        self.assertEqual(validate_url('https://research.ucsd.edu/'), 'https://research.ucsd.edu/')

    def test_inferred_deadline_becomes_unknown(self):
        item = self.record()
        item.update(deadline='2025-09-28',
                    deadline_text='September 28th (deadline extended 9/24/2025)')
        result = normalize([item], 'https://ucsd.edu/test', item['deadline_text'])[0]
        self.assertIsNone(result['deadline'])

    def test_explicit_closed_applications_are_expired(self):
        item = self.record()
        item['closure_evidence'] = 'Applications are currently closed.'
        result = normalize([item], 'https://ucsd.edu/test', item['closure_evidence'])[0]
        self.assertEqual(result['status'], 'expired')

    def test_numeric_time_values_and_filled_positions(self):
        item = self.record()
        item['eligibility'] = [dict(type='hours_per_week', value='12',
            raw_text='12 hours per week', is_hard_requirement=True)]
        result = normalize([item], 'https://ucsd.edu/test', '12 hours per week')[0]
        self.assertEqual(result['eligibility'][0]['value'], 12)
        item['eligibility'][0]['value'] = '>12'
        result = normalize([item], 'https://ucsd.edu/test', '12 hours per week')[0]
        self.assertEqual(result['eligibility'][0]['value'], '>12')
        item = self.record()
        item['closure_evidence'] = 'Position(s) have been filled.'
        result = normalize([item], 'https://ucsd.edu/test', item['closure_evidence'])[0]
        self.assertEqual(result['status'], 'expired')
