"""Exercise D -> B through the public demo API using fictional data only.

Explicit --save-fictional-profile opt-in creates/replaces the isolated demo
profile b-integration-20261114. No database credentials or internal token needed.
"""

import argparse
import json
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ORIGIN = 'https://ai-academic-compass.vercel.app'
DEMO_USER = 'b-integration-20261114'


def call(path, body=None, content_type='application/json'):
    headers = {'x-demo-user': DEMO_USER, 'Content-Type': content_type}
    request = Request(ORIGIN + path, data=body, headers=headers)
    try:
        response = urlopen(request, timeout=65)
    except HTTPError as error:
        response = error
    with response:
        try:
            value = json.loads(response.read(1024 * 1024))
        except ValueError:
            value = {'error': {'code': 'NON_JSON_RESPONSE'}}
        return response.status, value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--save-fictional-profile', action='store_true')
    args = parser.parse_args()
    try:
        status, opportunities = call('/api/opportunities?limit=20')
        print('GET opportunities:', status, 'records:', len(opportunities.get('items', [])))
        if status != 200:
            return 1
        if not args.save_fictional_profile:
            print('Read-only check complete. Use --save-fictional-profile to test D -> B.')
            return 0
        profile = {'university': 'UCSD', 'major': 'Data Science', 'academic_year': 'sophomore',
                   'skills': ['Python', 'SQL'], 'interests': ['machine learning'],
                   'selected_modules': ['research'], 'courses_taken': ['DSC 10'],
                   'experiences': [], 'hours_per_week': 8}
        status, value = call('/api/profile', json.dumps(profile).encode())
        print('POST fictional profile:', status)
        if status != 200:
            print('Error code:', value.get('error', {}).get('code'))
            return 1
        status, value = call('/api/match', b'{}')
        print('POST match:', status, 'results:', len(value.get('results', [])))
        if status != 200:
            print('Error code:', value.get('error', {}).get('code'))
            return 1
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'matching'))
        from test_resume import fictional_pdf
        body = (b'--publiccheck\r\nContent-Disposition: form-data; name="file"; filename="fictional.pdf"\r\n'
                b'Content-Type: application/pdf\r\n\r\n' + fictional_pdf()
                + b'\r\n--publiccheck\r\nContent-Disposition: form-data; name="use_ai"\r\n\r\nfalse'
                + b'\r\n--publiccheck--\r\n')
        status, value = call('/api/resume/parse', body, 'multipart/form-data; boundary=publiccheck')
        print('POST resume (local mode):', status)
        if status != 200 or value.get('extracted', {}).get('skills') != ['Python', 'SQL']:
            print('Error code:', value.get('error', {}).get('code', 'UNEXPECTED_EXTRACTION'))
            return 1
        print('PASS: public D -> B matching and PDF extraction completed.')
        return 0
    except (URLError, TimeoutError):
        print('FAIL: public API connection failed. No credentials were used.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
