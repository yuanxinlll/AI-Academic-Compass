"""Explicit organization URL scopes; never approve an entire social/shared host."""
import json
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlsplit

CATALOG = Path(__file__).with_name('student_org_sources.json')
SHARED_HOSTS = {'www.instagram.com', 'instagram.com', 'sites.google.com', 'linktr.ee', 'github.com'}


@lru_cache(maxsize=8)
def _read_catalog(path, modified_ns):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def approved_org_url(url, catalog=None):
    if catalog is None:
        if not CATALOG.exists():
            return False
        catalog = _read_catalog(str(CATALOG), CATALOG.stat().st_mtime_ns)
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None,443):
        return False
    path = unquote(unquote(parsed.path or '/'))
    if any(part in ('.','..') for part in path.split('/')) or '\\' in path:
        return False
    for source in catalog.get('sources', []):
        if (source.get('verification_status') != 'verified_ucsd_affiliated_source'
                or not source.get('fetch_enabled') or source.get('kind') != 'website'):
            continue
        for scope in source.get('approved_scopes', []):
            host, prefix = scope['hostname'], scope['path_prefix']
            if host in SHARED_HOSTS and prefix == '/':
                continue
            if parsed.hostname == host and (prefix == '/' or path == prefix or path.startswith(prefix.rstrip('/')+'/')):
                return True
    return False
