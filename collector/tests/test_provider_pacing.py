import unittest
from unittest.mock import patch, MagicMock
import collector.main as collector


class ProviderPacingTests(unittest.TestCase):
    def test_gemini_requests_are_spaced_but_other_providers_are_not(self):
        with patch.object(collector,'_gemini_next_request',0), patch.object(collector.time,'monotonic',return_value=100), patch.object(collector.time,'sleep') as sleep:
            collector.pace_gemini('https://generativelanguage.googleapis.com/v1beta/models/test:generateContent')
            collector.pace_gemini('https://generativelanguage.googleapis.com/v1beta/models/test:generateContent')
            sleep.assert_called_once_with(5)
            collector.pace_gemini('https://api.brightdata.com/request')
            sleep.assert_called_once_with(5)
