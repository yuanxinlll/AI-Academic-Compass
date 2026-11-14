"""Explicit integration check: disposable Docker PostgreSQL, never Neon."""
import json
import re
import secrets
import subprocess
import time
from datetime import datetime, timezone
from uuid import uuid4

from collector.storage import PostgresStore


def command(arguments, **kwargs):
    return subprocess.run(arguments, check=True, capture_output=True, text=True, encoding="utf-8", **kwargs)


def main(live=False):
    name = 'academic-compass-collector-test-' + uuid4().hex[:10]
    password = secrets.token_hex(24)
    started = False
    try:
        print('Starting isolated PostgreSQL test container...', flush=True)
        command(['docker', 'run', '--rm', '-d', '--name', name,
                 '--tmpfs', '/var/lib/postgresql/data:rw',
                 '-e', 'POSTGRES_PASSWORD=' + password,
                 '-p', '127.0.0.1::5432', 'postgres:17-alpine'])
        started = True
        for attempt in range(120):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'],
                                   capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('Test database did not start')
        port = json.loads(command(['docker', 'inspect', name]).stdout)[0][
            'NetworkSettings']['Ports']['5432/tcp'][0]['HostPort']
        schema = command(['git', 'show', 'origin/feature/backend:lib/database/schema.sql']).stdout
        # Use only the three public collection tables; never execute D's DROP or seed statements.
        fixture = '\n'.join(re.search(r'CREATE TABLE ' + table + r' \(.*?\n\);',
                                      schema, re.S).group(0)
                            for table in ('sources', 'opportunities', 'collection_logs'))
        command(['docker', 'exec', '-i', name, 'psql', '-v', 'ON_ERROR_STOP=1',
                 '-U', 'postgres'], input=fixture)

        class LocalStore(PostgresStore):
            def connect(self):
                # TLS is required by the production adapter; this loopback-only
                # disposable container has no certificate.
                return self.psycopg.connect(self.database_url, sslmode='disable', connect_timeout=5)

        store = LocalStore(f'postgresql://postgres:{password}@127.0.0.1:{port}/postgres')
        store.check_schema()
        url = 'https://example.ucsd.edu/collector-integration-test'
        stamp = datetime.now(timezone.utc).isoformat()
        record = dict(title='Synthetic collector integration test', university='UCSD',
                      organization=None, category='research', description=None,
                      required_skills=['Python'], eligibility=[
                          dict(type='skill', value='Python', raw_text='Python required',
                               is_hard_requirement=True)], deadline='2099-01-01',
                      deadline_text='2099-01-01', application_method=None,
                      source_url=url, source_id=None, first_collected_at=stamp,
                      last_verified_at=stamp, status='needs_verification')
        assert store.save_page(url, [record], stamp, []) == dict(inserted=1, updated=0, duplicates=0)
        original_id = record['opportunity_id']
        original_first = record['first_collected_at']
        assert store.save_page(url, [record], stamp, []) == dict(inserted=0, updated=0, duplicates=1)
        record['description'] = 'Updated synthetic description'
        assert store.save_page(url, [record], stamp, []) == dict(inserted=0, updated=1, duplicates=0)
        persisted = store.read_opportunity(url)
        assert str(persisted['opportunity_id']) == original_id
        assert persisted['first_collected_at'].isoformat() == original_first
        assert persisted['deadline'].isoformat() == '2099-01-01'
        assert persisted['eligibility'][0]['value'] == 'Python'
        assert store.resolve_source(record['source_id']) == url
        store.save_page(url, [], stamp, [{'code': 'http_503'}])
        with store.connect() as connection:
            assert connection.execute('SELECT count(*) FROM opportunities').fetchone()[0] == 1
            assert connection.execute('SELECT count(*) FROM collection_logs').fetchone()[0] == 4
        record['status'] = 'expired'
        store.save_page(url, [record], stamp, [])
        store.save_page(url, [], stamp, [{'code': 'http_503'}])
        assert store.read_opportunity(url)['status'] == 'expired'
        bad_url = 'https://example.ucsd.edu/collector-invalid-test'
        try:
            store.save_page(bad_url, [dict(record, source_url=bad_url, category='INVALID')], stamp, [])
        except Exception:
            pass
        else:
            raise AssertionError('Invalid record unexpectedly committed')
        with store.connect() as connection:
            assert connection.execute('SELECT count(*) FROM sources WHERE website_url=%s',
                                      (bad_url,)).fetchone()[0] == 0
        from pathlib import Path
        live_output = Path('collector/output/opportunities.json')
        if live_output.exists():
            real_records = json.loads(live_output.read_text(encoding='utf-8'))
            for real_record in real_records:
                copy = dict(real_record)
                store.save_page(copy['source_url'], [copy], stamp, [])
                saved = store.read_opportunity(copy['source_url'])
                assert saved['title'] == copy['title']
                assert saved['eligibility'] == copy['eligibility']
                assert (saved['deadline'].isoformat() if saved['deadline'] else None) == copy['deadline']
            print(f'PASS: saved and read back {len(real_records)} live-collected UCSD records in test PostgreSQL.', flush=True)
        if live:
            import tempfile
            from collector.pipeline import load_env, ROOT, run_collection
            load_env(ROOT / '.env')
            live_url = 'https://ugresearch.ucsd.edu/programs/all-urh-programs/fmp/index.html'
            with tempfile.TemporaryDirectory(prefix='collector-live-test-') as directory:
                state = Path(directory) / 'state.json'
                output = Path(directory) / 'records.json'
                report = run_collection([live_url], state, output, database=store, max_pages=1, delay=0)
                assert not report['errors'], report['errors']
                assert report['records_found'] == 1
                saved = store.read_opportunity(live_url)
                assert saved and saved['title']
                before_id = saved['opportunity_id']
                before_first = saved['first_collected_at']
                second = run_collection([live_url], state, output, database=store, max_pages=1, delay=0)
                assert not second['errors'], second['errors']
                assert second['inserted'] == 0
                saved = store.read_opportunity(live_url)
                assert saved['opportunity_id'] == before_id
                assert saved['first_collected_at'] == before_first
            print('PASS: real FMP source -> Bright Data -> Gemini -> validation -> PostgreSQL; repeat run preserves database identity.', flush=True)
        print('PASS: insert, duplicate upsert, update, stable ID/first timestamp, JSON/date roundtrip, source lookup, failure logs, transaction rollback.', flush=True)
    finally:
        if started:
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
            print('Removed isolated PostgreSQL test container.', flush=True)


if __name__ == '__main__':
    try:
        import argparse
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--live", action="store_true", help="Also call Bright Data and Gemini with local credentials")
        main(live=parser.parse_args().live)
    except Exception as error:
        print('PostgreSQL integration failed: ' + type(error).__name__, flush=True)
        raise SystemExit(1)
