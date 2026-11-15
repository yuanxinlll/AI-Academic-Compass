import unittest
from collector.approve_reviews import ready_reviews


class ReviewApprovalTests(unittest.TestCase):
    def dataset(self):
        return dict(records=[dict(opportunity_id='test-id', source_url='https://ucsd.edu/test',
                                  title='Reviewed title', status='needs_verification')],
                    reviews=[dict(source_url='https://ucsd.edu/test', requirements_complete=True)])

    def test_unchanged_complete_review_is_ready(self):
        dataset = self.dataset()
        self.assertEqual(len(ready_reviews(dataset, dataset['records'])), 1)

    def test_incomplete_review_cannot_be_approved(self):
        dataset = self.dataset()
        dataset['reviews'][0]['requirements_complete'] = False
        self.assertEqual(ready_reviews(dataset, dataset['records']), [])

    def test_changed_record_blocks_approval(self):
        dataset = self.dataset()
        changed = [dict(dataset['records'][0], title='Changed title')]
        with self.assertRaises(ValueError):
            ready_reviews(dataset, changed)
