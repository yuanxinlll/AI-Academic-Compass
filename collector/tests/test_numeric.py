import unittest
from collector.numeric import quantitative_value


class NumericTests(unittest.TestCase):
    def test_unambiguous_quantities_are_numbers(self):
        self.assertEqual(quantitative_value('gpa','3.5'),3.5)
        self.assertEqual(quantitative_value('hours_per_week','ten'),10)
        self.assertEqual(quantitative_value('duration','two consecutive quarters'),2)
        self.assertEqual(quantitative_value('duration','at least one year'),1)

    def test_ranges_and_non_quantities_are_not_collapsed(self):
        self.assertEqual(quantitative_value('duration','two to three quarters'),'2 to 3 quarters')
        self.assertEqual(quantitative_value('duration','2-3 quarters or more'),'2-3 quarters or more')
        self.assertEqual(quantitative_value('major','three dimensional art'),'three dimensional art')
        self.assertIsNone(quantitative_value('gpa',None))
