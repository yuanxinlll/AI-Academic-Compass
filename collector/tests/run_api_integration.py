"""Live, idempotent FMP upsert through the API; uses provider accounts, never SQL."""
import json
import os
from urllib.request import urlopen
from urllib.parse import urlencode

from collector.ingest import ApiStore, DEFAULT_BASE
from collector.pipeline import ROOT, atomic_json, load_env, run_collection

URL = 'https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html'


def read_record(base):
    matches = []
    for page in range(1, 21):
        query = urlencode({'q': 'Faculty Mentor', 'limit': 100, 'page': page})
        with urlopen(base + '/api/opportunities?' + query, timeout=30) as response:
            batch = json.load(response)
        matches.extend(row for row in batch['items'] if row['source_url'] == URL)
        if page * 100 >= batch['total']:
            break
    else:
        raise AssertionError('Public lookup exceeded page budget')
    assert len(matches) <= 1, 'Duplicate source URLs returned by backend'
    return matches[0] if matches else None


def main():
    load_env(ROOT / '.env')
    base = os.environ.get('COLLECTOR_API_BASE_URL', DEFAULT_BASE).rstrip('/')
    store = ApiStore(base, source_type='listing')
    before = read_record(base)
    runs = []
    snapshots = []
    for _ in range(2):
        report = run_collection([URL], ROOT/'output/api-ingest-state.json',
                                ROOT/'output/api-ingest-opportunities.json',
                                database=store, max_pages=1, delay=0)
        assert not report['errors'], json.dumps(report['errors'])
        assert report['records_found'] == 1
        assert report['inserted'] + report['updated'] == 1
        assert report['persistence'] == 'admin_api'
        saved = read_record(base)
        assert saved is not None, 'Saved source absent from public feed'
        local = json.loads((ROOT/'output/api-ingest-opportunities.json').read_text(encoding='utf-8'))[0]
        assert local['opportunity_id'] == saved['opportunity_id']
        for field in ('title', 'category', 'description', 'required_skills', 'eligibility',
                      'deadline', 'deadline_text', 'application_method'):
            assert local[field] == saved[field], 'Readback mismatch: ' + field
        assert saved['status'] in ('needs_verification', 'verified')
        assert saved['source_id'], 'Source not registered'
        snapshots.append(saved)
        runs.append(report)
    baseline = before or snapshots[0]
    for saved in snapshots:
        assert saved['opportunity_id'] == baseline['opportunity_id']
        assert saved['first_collected_at'] == baseline['first_collected_at']
        assert saved['source_id'] == baseline['source_id']
    assert snapshots[1]['last_verified_at'] >= snapshots[0]['last_verified_at']
    summary = {'source_url': URL, 'opportunity_id': snapshots[-1]['opportunity_id'],
               'database_url_required': False, 'stable_id': True,
               'stable_first_collected_at': True, 'source_registered': True,
               'public_api_readback_matches': True, 'runs': runs}
    atomic_json(ROOT/'output/api-ingest-verification.json', summary)
    print(json.dumps(summary))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not echo arbitrary remote response bodies or environment values.
        raise SystemExit('API integration test failed: ' + type(error).__name__) from None
