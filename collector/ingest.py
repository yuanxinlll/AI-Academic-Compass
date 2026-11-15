"""Authenticated HTTP persistence through D's existing ingestion API."""
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

DEFAULT_BASE = 'https://ai-academic-compass.vercel.app'
FIELDS = ('title', 'university', 'organization', 'category', 'description',
          'required_skills', 'eligibility', 'deadline', 'deadline_text',
          'application_method', 'source_url', 'status', 'access', 'source_kind')
SOURCE_TYPES = {'lab_page', 'department', 'calendar', 'listing', 'other'}


class IngestError(Exception):
    """Only fixed, credential-free codes may enter reports."""
    def __init__(self, code):
        self.code = code
        super().__init__(code)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the admin credential to another location.
        return None


class ApiStore:
    persistence = 'admin_api'

    def __init__(self, base_url=DEFAULT_BASE, admin_token=None, source_type='listing'):
        parts = urlsplit(base_url)
        local = parts.scheme == 'http' and parts.hostname in ('localhost', '127.0.0.1')
        if ((parts.scheme != 'https' and not local) or not parts.hostname or parts.username or
                parts.password or parts.query or parts.fragment or parts.path not in ('', '/')):
            raise ValueError('API base must be an HTTPS origin (or http://localhost for local dev)')
        token = admin_token if admin_token is not None else os.environ.get('ADMIN_TOKEN')
        if not token or not token.strip() or any(c in token for c in '\r\n'):
            raise ValueError('ADMIN_TOKEN must be configured')
        if source_type not in SOURCE_TYPES:
            raise ValueError('Invalid source_type')
        self.endpoint = base_url.rstrip('/') + '/api/admin/opportunities'
        self.token = token
        self.source_type = source_type
        self.opener = build_opener(NoRedirect())

    def _post(self, payload):
        request = Request(self.endpoint, data=json.dumps(payload, allow_nan=False).encode('utf-8'),
                          headers={'Content-Type': 'application/json',
                                   'x-admin-token': self.token}, method='POST')
        for attempt in range(3):
            try:
                with self.opener.open(request, timeout=30) as response:
                    return json.load(response)
            except HTTPError as error:
                code = error.code
                error.close()
                if code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise IngestError('ingest_http_' + str(code)) from None
            except (URLError, TimeoutError, OSError):
                if attempt == 2:
                    raise IngestError('ingest_network_error') from None
            except (ValueError, UnicodeError):
                raise IngestError('ingest_invalid_response') from None
            time.sleep(2 ** attempt)

    def save_page(self, url, records, checked_at, errors):
        counts = dict(inserted=0, updated=0, duplicates=0, rejected=0, errors=[], warnings=[])
        if errors or not records:
            counts['warnings'] = ['admin_api_cannot_log_failed_or_empty_source']
            return counts
        # Normalization/evidence checks happen upstream. Project only agreed input
        # fields: IDs and collection timestamps belong to the backend.
        items = [{field: record.get(field) for field in FIELDS} for record in records]
        for offset in range(0, len(items), 50):
            batch = items[offset:offset + 50]
            payload = {'source': {'website_url': url, 'source_type': self.source_type,
                                  'university': 'UCSD'}, 'opportunities': batch}
            result = self._post(payload)
            self._validate_result(result, len(batch))
            # Updated means an upsert of an existing URL, even if unchanged.
            # D's duplicates count overlaps updated; expose it without summing it.
            for key in ('inserted', 'updated', 'duplicates', 'rejected'):
                counts[key] += result[key]
            for saved in result['saved']:
                records[offset + saved['index']]['opportunity_id'] = saved['opportunity_id']
            for rejected in result['errors']:
                counts['errors'].append({'source_url': url, 'code': 'ingest_record_rejected',
                                         'index': offset + rejected['index']})
        return counts

    @staticmethod
    def _validate_result(result, size):
        try:
            if not isinstance(result, dict):
                raise ValueError()
            for key in ('inserted', 'updated', 'duplicates', 'rejected'):
                if type(result[key]) is not int or not 0 <= result[key] <= size:
                    raise ValueError()
            saved, errors = result['saved'], result['errors']
            if not isinstance(saved, list) or not isinstance(errors, list):
                raise ValueError()
            if (len(saved) != result['inserted'] + result['updated'] or
                    len(errors) != result['rejected'] or len(saved) + len(errors) != size):
                raise ValueError()
            indices = []
            for row in saved:
                indices.append(row['index'])
                UUID(row['opportunity_id'])
                if row['action'] not in ('inserted', 'updated'):
                    raise ValueError()
            indices.extend(row['index'] for row in errors)
            if any(type(i) is not int for i in indices) or sorted(indices) != list(range(size)):
                raise ValueError()
        except (KeyError, TypeError, ValueError, AttributeError):
            raise IngestError('ingest_invalid_response') from None
