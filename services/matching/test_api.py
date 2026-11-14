"""Exercise HTTP contracts on an ephemeral loopback port using fictional data."""

import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from demo import OPPORTUNITIES, PROFILES
from server import Handler, merge_profile


class ProfileMergeTests(unittest.TestCase):
    def test_confirmed_empty_list_is_not_overwritten(self):
        result = merge_profile({"skills": []}, {"skills": ["Python"]})
        self.assertEqual(result["profile_draft"]["skills"], [])
        self.assertEqual(len(result["conflicts"]), 1)

    def test_missing_values_are_filled_without_mutating_inputs(self):
        confirmed = {"skills": None}
        result = merge_profile(confirmed, {"skills": ["Python"], "major": None})
        self.assertEqual(result["profile_draft"]["skills"], ["Python"])
        self.assertIsNone(confirmed["skills"])
        self.assertNotIn("major", result["profile_draft"])
        self.assertTrue(result["requires_confirmation"])


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def request(self, path, data=None, raw=None):
        body = json.dumps(data).encode() if data is not None else raw
        request = Request(self.base + path, data=body,
                          headers={"Content-Type": "application/json"})
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read()

    def test_demo_page_and_data_are_available(self):
        status, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(b'<html lang="en">', body)
        status, body = self.request("/api/demo-data")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(body)["opportunities"]), 2)

    def test_matching_uses_server_records_and_deduplicates_ids(self):
        identity = OPPORTUNITIES[0]["opportunity_id"]
        status, body = self.request("/api/match", {
            "profile": PROFILES["fictional_data_science_student"],
            "opportunity_ids": [identity, identity],
        })
        self.assertEqual(status, 200)
        results = json.loads(body)["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["eligibility_status"], "ineligible")

    def test_invalid_requests_return_json_errors(self):
        for payload in ([], {"profile": []}, {"profile": {}, "opportunity_ids": ["missing"]},
                        {"profile": {"skills": "Python"}, "opportunity_ids": [OPPORTUNITIES[0]["opportunity_id"]]}):
            with self.subTest(payload=payload):
                status, body = self.request("/api/match", payload)
                self.assertEqual(status, 400)
                self.assertEqual(json.loads(body)["error"]["code"], "INVALID_INPUT")
        self.assertEqual(self.request("/api/match", raw=b'{broken')[0], 400)

    def test_merge_conflicts_are_returned(self):
        status, body = self.request("/api/profile/merge", {
            "confirmed": {"skills": ["Python"]}, "draft": {"skills": ["SQL"]},
        })
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(body)["conflicts"]), 1)

    def test_unimplemented_parser_and_unknown_route_are_explicit(self):
        self.assertEqual(self.request("/api/resume/parse", {})[0], 501)
        self.assertEqual(self.request("/api/missing", {})[0], 404)


if __name__ == "__main__":
    unittest.main()
