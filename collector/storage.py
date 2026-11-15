"""Adapter for D's existing PostgreSQL contract. Never creates or alters tables."""

COLUMNS = ('title', 'university', 'organization', 'category', 'description',
           'required_skills', 'eligibility', 'deadline', 'deadline_text',
           'application_method', 'source_url', 'source_id', 'first_collected_at',
           'last_verified_at', 'status')
MUTABLE = tuple(column for column in COLUMNS if column not in ('source_url', 'first_collected_at'))


class PostgresStore:
    def __init__(self, database_url):
        import psycopg
        self.psycopg = psycopg
        self.database_url = database_url

    def connect(self):
        return self.psycopg.connect(self.database_url, connect_timeout=15, sslmode='require')

    def check_schema(self):
        # Fail before paid provider calls when D's schema is unavailable.
        with self.connect() as connection:
            connection.execute('SELECT ' + ','.join(COLUMNS) + ',opportunity_id FROM opportunities LIMIT 0')
            connection.execute('SELECT source_id,university,website_url,source_type,last_checked_at FROM sources LIMIT 0')
            connection.execute('SELECT source_id,collection_time,records_found,errors FROM collection_logs LIMIT 0')

    def save_page(self, url, records, checked_at, errors):
        from psycopg.types.json import Jsonb
        from psycopg.rows import dict_row
        counts = dict(inserted=0, updated=0, duplicates=0)
        with self.connect() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (url,))
                cursor.execute(
                    """INSERT INTO sources (university,website_url,source_type,last_checked_at)
                       VALUES (%s,%s,%s,%s) ON CONFLICT (website_url) DO UPDATE
                       SET last_checked_at=EXCLUDED.last_checked_at RETURNING source_id""",
                    ('UCSD', url, 'listing', checked_at))
                source_id = cursor.fetchone()['source_id']
                for original in records:
                    cursor.execute('SELECT * FROM opportunities WHERE source_url=%s FOR UPDATE', (url,))
                    existing = cursor.fetchone()
                    record = dict(original, source_id=source_id)
                    from collector.pipeline import content_key
                    comparable_existing = dict(existing) if existing else None
                    if comparable_existing and comparable_existing.get('deadline') is not None:
                        comparable_existing['deadline'] = comparable_existing['deadline'].isoformat()
                    outcome = 'inserted' if existing is None else (
                        'duplicates' if content_key(comparable_existing) == content_key(record) else 'updated')
                    counts[outcome] += 1
                    record['eligibility'] = Jsonb(record['eligibility'])
                    updates = ','.join(column + '=EXCLUDED.' + column for column in MUTABLE)
                    # Preserve the database ID and first_collected_at on repeated collections.
                    cursor.execute(
                        'INSERT INTO opportunities (' + ','.join(COLUMNS) + ') VALUES ('
                        + ','.join(['%s'] * len(COLUMNS)) + ') ON CONFLICT (source_url) DO UPDATE SET '
                        + updates + ' RETURNING opportunity_id,first_collected_at',
                        tuple(record[column] for column in COLUMNS))
                    row = cursor.fetchone()
                    original['opportunity_id'] = str(row['opportunity_id'])
                    original['source_id'] = str(source_id)
                    original['first_collected_at'] = row['first_collected_at'].isoformat()
                if errors:
                    cursor.execute(
                        "UPDATE opportunities SET status='needs_verification' WHERE source_url=%s AND status <> 'expired'",
                        (url,))
                cursor.execute(
                    'INSERT INTO collection_logs (source_id,collection_time,records_found,errors) VALUES (%s,%s,%s,%s)',
                    (source_id, checked_at, len(records), Jsonb(errors)))
        return counts

    def read_opportunity(self, url):
        from psycopg.rows import dict_row
        with self.connect() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute('SELECT * FROM opportunities WHERE source_url=%s', (url,))
                return cursor.fetchone()

    def resolve_source(self, source_id):
        with self.connect() as connection:
            row = connection.execute('SELECT website_url FROM sources WHERE source_id=%s', (source_id,)).fetchone()
            return row[0] if row else None
