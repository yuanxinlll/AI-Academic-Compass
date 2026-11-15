"""Read UCSD's public current-organization directory without member information."""
import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from collector.pipeline import ROOT, atomic_json

DIRECTORY = 'https://studentorg.ucsd.edu/'


def clean(html):
    return ' '.join(unescape(re.sub(r'<[^>]+>', ' ', html)).split())


def read(url):
    with urlopen(Request(url, headers={'User-Agent': 'AcademicCompass-SourceReview/1.0'}), timeout=20) as response:
        return response.read().decode('utf-8')


def parse_directory(html):
    return [{'organization': clean(name), 'directory_url': urljoin(DIRECTORY, href)}
            for href, name in re.findall(r'<a[^>]+href="([^" ]*/Home/Details/\d+)"[^>]*>(.*?)</a>', html, re.S)]


def parse_record(html, source):
    # Select named organization fields only. Never retain members, emails or advisors.
    fields = {clean(key): clean(value) for key, value in
              re.findall(r'<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>', html, re.S)}
    return dict(source, academic_year=fields.get('Academic Year'),
                registration_status=fields.get('Status'),
                organization_type=fields.get('Organization Type'),
                social_media=fields.get('Social Media', ''),
                checked_at=datetime.now(timezone.utc).isoformat())


def scan(limit=50):
    indexed = parse_directory(read(DIRECTORY))
    def inspect(source):
        try:
            return parse_record(read(source['directory_url']), source)
        except Exception:
            return dict(source, registration_status='unavailable', social_media='')
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(inspect, indexed[:limit]))
    return {'directory_url': DIRECTORY, 'directory_count': len(indexed),
            'records_checked': len(rows), 'organizations': rows,
            'indexed_organizations': indexed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=50)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error('limit must be 1..1000')
    data = scan(args.limit)
    atomic_json(ROOT/'output/student-org-directory.json', data)
    print(json.dumps({'directory_count': data['directory_count'], 'records_checked': data['records_checked'],
                      'with_social_field': sum(bool(r.get('social_media')) for r in data['organizations']),
                      'unavailable': sum(r.get('registration_status') == 'unavailable' for r in data['organizations'])}))


if __name__ == '__main__':
    main()
