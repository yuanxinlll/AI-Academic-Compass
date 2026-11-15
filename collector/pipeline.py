"""Bounded collection runs and repeatable local monitoring."""
import argparse
import hashlib
import json
import os
import time
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError

from collector.main import extract, fetch_page, normalize
from collector.text import canonical_url, parse_page, is_directory

ROOT = Path(__file__).resolve().parent
EXTRACTION_VERSION = 'contract-v6-student-orgs'


def load_env(path):
    """Load local dotenv values without executing shell code or overriding exports."""
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' not in line:
            raise ValueError('Invalid environment file line')
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if not key.replace('_', '').isalnum():
            raise ValueError('Invalid environment variable name')
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        os.environ.setdefault(key, value)


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    temporary.replace(path)


def error_code(error):
    # Provider messages can contain credentials; never persist them.
    from collector.ingest import IngestError
    if isinstance(error, IngestError):
        return error.code
    if isinstance(error, HTTPError):
        return f'http_{error.code}'
    if isinstance(error, URLError):
        return 'network_error'
    if isinstance(error, ValueError):
        return 'validation_failed'
    return type(error).__name__


def collect_page(page, url, extractor=extract):
    feedback = None
    for attempt in range(2):
        try:
            return normalize(extractor(page, feedback=feedback), url, page)
        except ValueError as error:
            if attempt:
                raise
            feedback = str(error)
    raise AssertionError('unreachable')


def content_key(record):
    return {key: value for key, value in record.items()
            if key not in ('first_collected_at', 'last_verified_at', 'opportunity_id', 'source_id')}


def duplicate_identity(record):
    from collector.text import comparable
    fields = content_key(record)
    fields.pop('source_url', None)
    return json.dumps({key: comparable(value).casefold() if isinstance(value, str) else value
                       for key, value in fields.items()}, sort_keys=True, ensure_ascii=False)


def run_collection(urls, state_path, output_path, *, discover=False, max_pages=5,
                   max_depth=1, force=False, database=None, fetcher=fetch_page,
                   extractor=extract, delay=0.25, discovery_policy=None):
    if not 1 <= max_pages <= 100 or not 0 <= max_depth <= 5:
        raise ValueError('Page budget must be 1..100 and depth 0..5')
    state_path = Path(state_path)
    state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'pages': {}}
    queue = [(canonical_url(url), 0) for url in urls]
    seen = set()
    report = dict(websites_checked=0, pages_retrieved=0, records_found=0,
                  inserted=0, updated=0, duplicates=0, needs_verification=0,
                  expired=0, rejected=0, errors=[], persistence_warnings=[], discovered_urls=[], pages=[])
    while queue and len(seen) < max_pages:
        url, depth = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        report['websites_checked'] += 1
        checked_at = datetime.now(timezone.utc).isoformat()
        previous = state['pages'].get(url, {})
        page = None
        try:
            html = fetcher(url)
            report['pages_retrieved'] += 1
            page, links = parse_page(html, url)
            if not page:
                raise ValueError('Empty page')
            if len(page) > 180000:
                raise ValueError('Source too large; choose a detail page')
            if discovery_policy is not None:
                links = discovery_policy.links(html, url, links)
            if discover and depth < max_depth:
                for link in links:
                    if link not in report['discovered_urls']:
                        report['discovered_urls'].append(link)
                    queue.append((link, depth + 1))
            digest = hashlib.sha256(page.encode()).hexdigest()
            unchanged = not force and previous.get('digest') == digest and previous.get('extraction_version') == EXTRACTION_VERSION
            alias = previous.get('duplicate_of')
            if alias and (not state['pages'].get(alias, {}).get('records')
                          or state['pages'].get(alias, {}).get('error')):
                unchanged = False
            directory = is_directory(url) or (discovery_policy is not None and discovery_policy.is_directory(url))
            if directory:
                records = []
            elif unchanged:
                records = [dict(record) for record in previous.get('records', [])]
                for record in records:
                    record['last_verified_at'] = checked_at
                    if record['deadline'] and date.fromisoformat(record['deadline']) < datetime.now(timezone.utc).date():
                        record['status'] = 'expired'
            else:
                records = collect_page(page, url, extractor)
            old_records = previous.get('records', [])
            if not records and old_records and not directory:
                raise ValueError('Previously collected opportunity is no longer identifiable')
            for record in records:
                if old_records:
                    record['first_collected_at'] = old_records[0]['first_collected_at']
            alias_of = previous.get('duplicate_of') if unchanged else None
            report['records_found'] += len(records)
            if records and records[0].get('organization') and records[0].get('description'):
                identity = duplicate_identity(records[0])
                for known_url, entry in state['pages'].items():
                    if known_url != url and any(duplicate_identity(other) == identity
                                               for other in entry.get('records', [])):
                        alias_of = known_url
                        records = []
                        report['duplicates'] += 1
                        break
            outcome = 'duplicate_alias' if alias_of else 'empty'
            if records:
                outcome = 'inserted' if not old_records else (
                    'duplicates' if content_key(records[0]) == content_key(old_records[0]) else 'updated')
                if not database:
                    report[outcome] += 1
                report['needs_verification'] += sum(r['status'] == 'needs_verification' for r in records)
                report['expired'] += sum(r['status'] == 'expired' for r in records)
            if database:
                if discovery_policy is not None and hasattr(database, 'source_type'):
                    database.source_type = discovery_policy.source_type(url)
                counts = database.save_page(url, records, checked_at, [])
                if isinstance(counts, dict):
                    for key in ('inserted', 'updated', 'duplicates'):
                        report[key] += counts.get(key, 0)
                    report['rejected'] += counts.get('rejected', 0)
                    report['errors'].extend(counts.get('errors', []))
                    for warning in counts.get('warnings', []):
                        report['persistence_warnings'].append(dict(source_url=url, code=warning))
            state['pages'][url] = dict(digest=digest, records=records, last_checked_at=checked_at,
                                       links=links, error=None, duplicate_of=alias_of,
                                       source_text=page, extraction_version=EXTRACTION_VERSION)
            report['pages'].append(dict(url=url, outcome=outcome, extraction_cached=unchanged))
        except Exception as error:
            code = error_code(error)
            if isinstance(error, HTTPError):
                error.close()
            entry = dict(source_url=url, code=code)
            report['errors'].append(entry)
            # Keep last good records on transient errors, but make uncertainty explicit.
            retained = [dict(record, status=(
                'expired' if record.get('status') == 'expired' else 'needs_verification'
            )) for record in previous.get('records', [])]
            state['pages'][url] = dict(previous, records=retained, last_checked_at=checked_at, error=code,
                                       source_text=page or previous.get('source_text', ''))
            if database:
                try:
                    logged = database.save_page(url, [], checked_at, [entry])
                    if isinstance(logged, dict):
                        for warning in logged.get('warnings', []):
                            report['persistence_warnings'].append(dict(source_url=url, code=warning))
                except Exception as log_error:
                    report['errors'].append(dict(source_url=url, code='database_log_' + error_code(log_error)))
            report['pages'].append(dict(url=url, outcome='failed', code=code))
        atomic_json(state_path, state)
        if delay and queue:
            time.sleep(delay)
    records = [record for entry in state['pages'].values() for record in entry.get('records', [])]
    atomic_json(output_path, records)
    report['pending_urls'] = len({url for url, _ in queue} - seen)
    report['persistence'] = getattr(database, 'persistence', 'postgresql') if database else 'local_json'
    report['checked_at'] = datetime.now(timezone.utc).isoformat()
    return report


def cli():
    parser = argparse.ArgumentParser(description='Collect and monitor public UCSD opportunities.')
    parser.add_argument('--url', action='append', default=[])
    parser.add_argument('--sources', type=Path)
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/opportunities.json')
    parser.add_argument('--state', type=Path, default=ROOT / 'output/state.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'output/report.json')
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--max-pages', type=int, default=5)
    parser.add_argument('--max-depth', type=int, default=1)
    parser.add_argument('--force', action='store_true', help='Re-extract even when page text is unchanged')
    persistence = parser.add_mutually_exclusive_group()
    persistence.add_argument('--database', action='store_true', help='Legacy direct PostgreSQL mode; requires DATABASE_URL')
    persistence.add_argument('--ingest', action='store_true', help='Save through D admin API; requires ADMIN_TOKEN, no database driver')
    from collector.ingest import DEFAULT_BASE, SOURCE_TYPES
    parser.add_argument('--api-base-url', default=None, help='HTTPS origin; defaults to COLLECTOR_API_BASE_URL or deployed app')
    parser.add_argument('--source-type', choices=sorted(SOURCE_TYPES), default='listing')
    parser.add_argument('--interval', type=int, default=0, help='Repeat every N seconds (minimum 60); Ctrl+C stops')
    args = parser.parse_args()
    try:
        load_env(args.env_file)
        urls = args.url
        if args.sources:
            urls.extend(json.loads(args.sources.read_text(encoding='utf-8')))
        if not urls:
            raise ValueError('Supply --url or --sources')
        urls = list(dict.fromkeys(canonical_url(url) for url in urls))
        if args.interval and args.interval < 60:
            raise ValueError('Minimum monitoring interval is 60 seconds')
        for key in ('BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE', 'GEMINI_API_KEY', 'GEMINI_MODEL'):
            if not os.environ.get(key):
                raise ValueError('Missing setting: ' + key)
        database = None
        if args.ingest:
            from collector.ingest import ApiStore
            database = ApiStore(args.api_base_url or os.environ.get('COLLECTOR_API_BASE_URL', DEFAULT_BASE),
                                source_type=args.source_type)
        if args.database:
            from collector.storage import PostgresStore
            database = PostgresStore(os.environ['DATABASE_URL'])
            database.check_schema()
        while True:
            report = run_collection(urls, args.state, args.output, discover=args.discover,
                                    max_pages=args.max_pages, max_depth=args.max_depth,
                                    force=args.force, database=database)
            atomic_json(args.report, report)
            print(json.dumps(report), flush=True)
            if not args.interval:
                if report['errors']:
                    raise SystemExit(1)
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print('Monitoring stopped.')
    except Exception as error:
        parser.exit(1, 'Collection failed: ' + error_code(error) + '\n')
