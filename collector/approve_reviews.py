"""Review/apply D's admin verification gate for unchanged source-reviewed records."""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from collector.pipeline import ROOT, load_env, atomic_json, content_key

BASE = 'https://ai-academic-compass.vercel.app'


def ready_reviews(dataset, current):
    by_id = {record['opportunity_id']: record for record in current}
    ready = []
    for review in dataset['reviews']:
        if not review['requirements_complete']:
            continue
        expected = next(record for record in dataset['records']
                        if record['source_url'] == review['source_url'])
        actual = by_id.get(expected['opportunity_id'])
        if actual is None:
            raise ValueError('Reviewed record is missing from the active feed')
        wanted, found = content_key(expected), content_key(actual)
        wanted.pop('status', None)
        found.pop('status', None)
        if wanted != found:
            raise ValueError('Published record changed after source review')
        ready.append(actual)
    return ready


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'reviews/ucsd-opportunities-2026-11-14.json')
    parser.add_argument('--apply', action='store_true',
                        help='Confirm published-source/requirement review and apply verified status with ADMIN_TOKEN')
    args = parser.parse_args()
    try:
        load_env(ROOT / '.env')
        if args.apply and not os.environ.get('ADMIN_TOKEN'):
            raise ValueError('ADMIN_TOKEN must be configured locally for admin approval')
        dataset = json.loads(args.manifest.read_text(encoding='utf-8'))
        current = []
        for page in range(1, 21):
            with urlopen(BASE + '/api/opportunities?limit=100&page=' + str(page), timeout=30) as response:
                batch = json.load(response)
            current.extend(batch['items'])
            if len(current) >= batch['total']:
                break
        else:
            raise ValueError('Public feed exceeded the bounded review lookup')
        ready = ready_reviews(dataset, current)
        if not args.apply:
            print(json.dumps({'ready_for_admin_review': len(ready),
                              'records': [{'opportunity_id': r['opportunity_id'], 'title': r['title'],
                                           'source_url': r['source_url']} for r in ready]}, indent=2))
            return
        approved = 0
        for record in ready:
            request = Request(BASE + '/api/admin/opportunities/' + record['opportunity_id'],
                              data=json.dumps({'status': 'verified'}).encode(),
                              headers={'Content-Type': 'application/json',
                                       'x-admin-token': os.environ['ADMIN_TOKEN']}, method='PATCH')
            with urlopen(request, timeout=30) as response:
                result = json.load(response)['opportunity']
            if result['status'] != 'verified':
                raise ValueError('Admin endpoint did not confirm verification')
            expected = next(r for r in dataset['records'] if r['opportunity_id'] == record['opportunity_id'])
            expected.update(status='verified', last_verified_at=result['last_verified_at'])
            review = next(r for r in dataset['reviews'] if r['source_url'] == record['source_url'])
            review['database_status'] = 'verified'
            approved += 1
        dataset['note'] = 'Source review performed by Codex; complete review candidates approved through D admin endpoint.'
        atomic_json(args.manifest, dataset)
        print(json.dumps({'approved': approved}))
    except HTTPError as error:
        status = error.code
        error.close()
        parser.exit(1, 'Admin review request failed: HTTP ' + str(status) + '\n')
    except ValueError as error:
        parser.exit(1, str(error) + '\n')
    except Exception as error:
        parser.exit(1, 'Review check failed: ' + type(error).__name__ + '\n')


if __name__ == '__main__':
    main()
