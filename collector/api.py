"""Python entry point for D to mount behind POST /api/collect."""
import hmac
import json
import os
import sys
import tempfile
from pathlib import Path
from uuid import UUID

from collector.pipeline import ROOT, load_env, run_collection
from collector.text import canonical_url


def failure(code, message, status):
    return {'error': {'code': code, 'message': message}}, status


def collect_request(payload, admin_token, *, store=None):
    expected = os.environ.get('ADMIN_TOKEN')
    if not expected:
        return failure('NOT_CONFIGURED', 'Collection administration is not configured.', 503)
    if not isinstance(admin_token, str) or not hmac.compare_digest(
        admin_token.encode(), expected.encode()
    ):
        return failure('UNAUTHORIZED', 'Invalid administrator token.', 401)
    if not isinstance(payload, dict) or set(payload) not in ({'url'}, {'source_id'}):
        return failure('INVALID_INPUT', 'Provide exactly one of url or source_id.', 400)
    try:
        if 'url' in payload:
            url = canonical_url(payload['url'])
        else:
            source_id = str(UUID(payload['source_id']))
    except (ValueError, TypeError, AttributeError):
        return failure('INVALID_INPUT', 'Invalid UCSD source URL or source ID.', 400)
    try:
        if store is None:
            from collector.storage import PostgresStore
            store = PostgresStore(os.environ['DATABASE_URL'])
        store.check_schema()
        if 'source_id' in payload:
            url = store.resolve_source(source_id)
            if url is None:
                return failure('NOT_FOUND', 'Source not found.', 404)
            url = canonical_url(url)
        with tempfile.TemporaryDirectory(prefix='academic-compass-collect-') as directory:
            report = run_collection([url], Path(directory) / 'state.json',
                                    Path(directory) / 'records.json', database=store,
                                    max_pages=1, delay=0)
        body = {key: report[key] for key in (
            'records_found', 'inserted', 'updated', 'duplicates',
            'needs_verification', 'errors')}
        return body, 502 if report['errors'] else 200
    except Exception:
        return failure('INTEGRATION_UNAVAILABLE', 'Collection integration is unavailable.', 503)


def main():
    load_env(ROOT / '.env')
    try:
        request = json.load(sys.stdin)
        body, status = collect_request(request.get('body'),
                                       request.get('headers', {}).get('x-admin-token'))
    except Exception:
        body, status = failure('INVALID_INPUT', 'Invalid JSON request.', 400)
    print(json.dumps({'status': status, 'body': body}))


if __name__ == '__main__':
    main()
