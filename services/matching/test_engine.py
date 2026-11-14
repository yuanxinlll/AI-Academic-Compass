"""Behavior checks using fictional data only."""

import unittest
from copy import deepcopy

from demo import OPPORTUNITIES, PROFILES
from engine import match


class MatchingTests(unittest.TestCase):
    def test_different_profiles_receive_different_rankings(self):
        rankings = [match(profile, OPPORTUNITIES)["results"][0]["opportunity_id"]
                    for profile in PROFILES.values()]
        self.assertNotEqual(*rankings)

    def test_explicit_time_failure_is_ineligible(self):
        profile = PROFILES["fictional_data_science_student"]
        result = match(profile, OPPORTUNITIES)["results"][0]
        self.assertEqual(result["eligibility_status"], "ineligible")
        self.assertEqual(result["match_score"], 100)

    def test_missing_time_is_unknown(self):
        profile = deepcopy(PROFILES["fictional_data_science_student"])
        profile["weekly_hours_available"] = None
        result = match(profile, OPPORTUNITIES)["results"][0]
        self.assertEqual(result["eligibility_status"], "needs_verification")
        self.assertTrue(result["questions_to_confirm"])

    def test_passing_rules_does_not_claim_complete_eligibility(self):
        profile = deepcopy(PROFILES["fictional_data_science_student"])
        profile["weekly_hours_available"] = 12
        result = match(profile, OPPORTUNITIES)["results"][0]
        self.assertTrue(all(c["result"] == "met" for c in result["eligibility_checks"]))
        self.assertEqual(result["eligibility_status"], "needs_verification")

    def test_unknown_requirement_is_preserved(self):
        opportunity = deepcopy(OPPORTUNITIES[0])
        opportunity["eligibility"] = ["Prior laboratory approval is required."]
        result = match({}, [opportunity])["results"][0]
        self.assertEqual(result["eligibility_checks"][0]["result"], "unknown")
        self.assertIsNone(result["match_score"])

    def test_invalid_availability_is_rejected(self):
        for hours in (-1, True, "10", 169):
            with self.subTest(hours=hours), self.assertRaises(ValueError):
                match({"weekly_hours_available": hours}, OPPORTUNITIES)

    def test_no_opportunities_are_hidden(self):
        self.assertEqual(len(match({}, OPPORTUNITIES)["results"]), 2)

    def test_unknown_requirement_blocks_positive_claim(self):
        opportunity = deepcopy(OPPORTUNITIES[0])
        opportunity["eligibility"] = ["Applicants must have Python experience."]
        result = match({"skills": ["Python"]}, [opportunity])["results"][0]
        self.assertEqual(result["eligibility_status"], "needs_verification")

    def test_relevance_does_not_match_partial_words(self):
        profile = {"skills": ["R"]}
        result = match(profile, OPPORTUNITIES)["results"]
        self.assertTrue(all(item["match_score"] == 0 for item in result))

    def test_scores_are_bounded_and_inputs_are_unchanged(self):
        original = deepcopy(OPPORTUNITIES)
        for profile in PROFILES.values():
            for item in match(profile, OPPORTUNITIES)["results"]:
                self.assertTrue(0 <= item["match_score"] <= 100)
        self.assertEqual(OPPORTUNITIES, original)


if __name__ == "__main__":
    unittest.main()
