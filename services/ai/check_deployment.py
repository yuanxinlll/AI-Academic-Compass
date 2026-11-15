"""Live smoke checks against the configured AI production origin.

Uses fictional data only and never calls Gemini. The internal token is hidden
and process-local. Run interactively from the repository root.
"""

import getpass
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ORIGIN = 'https://academic-compass-ai.vercel.app'


def request(path, body, token=None, content_type='application/json'):
    headers = {'Content-Type': content_type}
    if token:
        headers['x-internal-token'] = token
    req = Request(ORIGIN + path, data=body, headers=headers)
    try:
        response = urlopen(req, timeout=45)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read(1024 * 1024)
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeError):
            raise ValueError('Expected JSON; check Vercel deployment protection or runtime logs.') from None
        return response.status, value


def main():
    print('Target:', ORIGIN)
    print('Only fictional data is sent. Gemini is not called.')
    token = os.environ.get('INTERNAL_TOKEN')
    if not token:
        if not sys.stdin.isatty():
            print('Run interactively or set INTERNAL_TOKEN in this process environment.')
            return 2
        token = getpass.getpass('Internal token (hidden, not saved): ').strip()
    try:
        status, value = request('/internal/match', b'{"profile":{},"opportunities":[]}')
        if status != 401 or value.get('error', {}).get('code') != 'UNAUTHORIZED':
            raise ValueError('Unauthenticated request did not return expected HTTP 401.')
        print('PASS: unauthenticated requests are rejected.')
        opportunity = {
            'opportunity_id': '00000000-0000-4000-8000-000000000001',
            'title': 'Fictional Python Research', 'description': 'Python research.',
            'category': 'research', 'required_skills': [], 'eligibility': [],
            'status': 'verified',
        }
        status, value = request('/internal/match', json.dumps({
            'profile': {'skills': ['Python']}, 'opportunities': [opportunity]}).encode(), token)
        if status != 200:
            raise ValueError(f'Authenticated matching failed with HTTP {status}. Check the shared token and service logs.')
        item = value['results'][0]
        if item['eligibility']['status'] != 'eligible' or item['relevance_score'] != 100:
            raise ValueError('Matching response did not satisfy the expected v1.1 result.')
        print('PASS: authenticated matching returns the expected v1.1 result.')
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'matching'))
        from test_resume import fictional_pdf
        body = (b'--smoke\r\nContent-Disposition: form-data; name="file"; filename="fictional.pdf"\r\n'
                b'Content-Type: application/pdf\r\n\r\n' + fictional_pdf()
                + b'\r\n--smoke\r\nContent-Disposition: form-data; name="use_ai"\r\n\r\nfalse'
                + b'\r\n--smoke--\r\n')
        status, value = request('/internal/resume/parse', body, token, 'multipart/form-data; boundary=smoke')
        if status != 200 or value.get('extracted', {}).get('skills') != ['Python', 'SQL']:
            raise ValueError(f'Fictional PDF extraction check failed (HTTP {status}).')
        print('PASS: authenticated PDF extraction returns expected skills.')
        print('PASS: deployment smoke checks completed. No secrets were saved.')
        return 0
    except (ValueError, KeyError, IndexError, URLError, TimeoutError):
        print('FAIL: deployment checks did not complete. Verify the token, deployment protection, and runtime logs. Do not share secrets.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
