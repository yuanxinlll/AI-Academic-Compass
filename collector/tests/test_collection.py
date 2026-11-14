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

    def test_source_boundary(self):
        for url in ['http://ucsd.edu', 'https://ucsd.edu.evil.com', 'https://localhost']:
            with self.assertRaises(ValueError):
                validate_url(url)
        self.assertEqual(validate_url('https://research.ucsd.edu/'), 'https://research.ucsd.edu/')
