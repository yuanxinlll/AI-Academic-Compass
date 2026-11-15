"""Category-budgeted source discovery and the collector's internal URL registry."""
import argparse
import json
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

from collector.ingest import ApiStore, DEFAULT_BASE, SOURCE_TYPES
from collector.main import CATEGORIES
from collector.pipeline import ROOT, atomic_json, error_code, load_env, run_collection
from collector.text import PageParser, canonical_url

GROUPS = ('research', 'internship', 'event', 'competition', 'program', 'course')
PATTERNS = {
    'research': r'research|opportunit|join|opening|laborator|/lab|/all-urh-programs/',
    'internship': r'internship|student-employment|campus-employment|career|/jobs|/aip|/ucdc|/uccs',
    'event': r'/events?(?:/|$)|workshop|seminar|lecture|conference|symposium',
    'competition': r'compet|challenge|hackathon|accelerate|/programs/|funding|/projects/',
    'program': r'/all-urh-programs/|fellow|summer|scholar|exchange|program',
    'course': r'carpentr|workshop|training|learning|tutorial|course|instruction|resource',
}
SKIP = re.compile(r'login|log-in|sign-in|signup|sign-up|privacy|accessibility|/search|'
                  r'/archive|past-event|/news/|/giving|/donat|/about|/contact|/confirm|/register|/attend|/save|/board|/dashboard|/sponsor|be-a-mentor', re.I)


def load_registry(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if data.get('version') != 1 or not isinstance(data.get('sources'), list):
        raise ValueError('Invalid source registry')
    seen = set()
    for source in data['sources']:
        try:
            url = canonical_url(source['url'])
        except ValueError:
            # Keep revoked organization sources as disabled metadata rather than
            # failing every other source after a verification refresh.
            parsed = urlsplit(source['url'])
            if (source.get('source_family') != 'student_orgs' or source['enabled']
                    or parsed.scheme != 'https' or not parsed.hostname or parsed.username
                    or parsed.password or parsed.port not in (None,443)
                    or len(source['url']) > 2000 or any(c.isspace() for c in source['url'])):
                raise
            url = urlunsplit(('https',parsed.hostname,parsed.path or '/',parsed.query,''))
        if source['url'] != url or url in seen:
            raise ValueError('Registry URLs must be unique and canonical')
        seen.add(url)
        groups = source['discovery_groups']
        if not isinstance(groups, list) or not groups or not set(groups) <= CATEGORIES:
            raise ValueError('Invalid discovery groups')
        if source['role'] not in ('directory', 'detail') or source['source_type'] not in SOURCE_TYPES:
            raise ValueError('Invalid registry source role/type')
        if source['stage'] not in ('seed', 'candidate', 'collected', 'source_reviewed'):
            raise ValueError('Invalid registry stage')
        if type(source['enabled']) is not bool or not isinstance(source['provenance'], list):
            raise ValueError('Invalid registry metadata')
    data.setdefault('external_candidates', [])
    return data


class DiscoveryPolicy:
    def __init__(self, data, group):
        self.data = data
        self.group = group
        self.sources = {s['url']: s for s in data['sources']}
        self.observed = []

    def is_directory(self, url):
        alias = url.replace('/index.html', '/') if url.endswith('/index.html') else url
        return any(s['role'] == 'directory' for key, s in self.sources.items()
                   if key == url or key == alias)

    def source_type(self, url):
        if url in self.sources:
            return self.sources[url]['source_type']
        return 'calendar' if urlsplit(url).hostname == 'calendar.ucsd.edu' else 'listing'

    def links(self, html, parent, links):
        now = datetime.now(timezone.utc).isoformat()
        # Preserve off-domain destinations as a review queue, never silently trust
        # arbitrary links or carry an admin credential to a source website.
        parser = PageParser()
        parser.feed(html)
        known_external = {s['url'] for s in self.data['external_candidates']}
        for href in parser.links:
            target = urlsplit(urljoin(parent, href))
            host = target.hostname
            if (target.scheme not in ('http', 'https') or not host or target.username or
                    target.password or host == 'ucsd.edu' or host.endswith('.ucsd.edu')):
                continue
            from collector.source_policy import approved_org_url
            if approved_org_url(urljoin(parent, href)):
                continue
            if any(s in host for s in ('facebook.', 'twitter.', 'linkedin.', 'youtube.')):
                continue
            url = urlunsplit((target.scheme, target.netloc, target.path or '/', target.query, ''))
            if url not in known_external and len(self.data['external_candidates']) < 500:
                self.data['external_candidates'].append(dict(url=url, discovered_from=parent,
                    discovery_group=self.group, observed_at=now, status='needs_review',
                    reason='outside_current_fetch_allowlist'))
                known_external.add(url)
        parent_host = urlsplit(parent).hostname
        def score(url):
            path = urlsplit(url).path
            from collector.source_policy import approved_org_url
            organization_child = approved_org_url(url)
            if SKIP.search(path) or re.search(r'\.(?:ico|webp|woff2?|ttf|map)$',path,re.I):
                return -1
            if not organization_child and not re.search(PATTERNS[self.group], path, re.I):
                return -1
            if self.group == 'competition' and parent_host == 'rady.ucsd.edu':
                if urlsplit(url).hostname == parent_host and not path.startswith('/why/centers/sullivan/'):
                    return -1
            value = 2 if urlsplit(url).hostname == parent_host else 0
            if organization_child:
                value += 3 * bool(re.search(PATTERNS[self.group],path,re.I))
            value -= 1 * bool(self.sources.get(url, {}).get('last_error'))
            if self.group == 'research':
                value += 6 * ('/all-urh-programs/' in path)
                value -= 5 * bool(re.search(r'/conferences/|/research-mentors/', path))
            if self.group == 'event':
                value += 5 * bool(re.search(r'workshop|seminar|lecture|conference|symposium|academic', path, re.I))
                value -= 10 * bool(re.search(r'basketball|soccer|volleyball|concert|dance|yoga|meditation', path, re.I))
            if self.group == 'program':
                value += 5 * ('/all-urh-programs/' in path)
            if self.group == 'competition':
                value += 5 * bool(re.search(r'compet|challenge|hackathon', path, re.I))
            if self.group == 'course':
                value += 5 * bool(re.search(r'carpentr|tutorial|instruction|learning', path, re.I))
            return value
        selected = sorted((url for url in links if score(url) >= 0), key=lambda url: (-score(url), url))
        for url in selected:
            self.observed.append(dict(url=url, discovered_from=parent, discovery_group=self.group))
            if url not in self.sources:
                role = 'directory' if urlsplit(url).path.rstrip('/').split('/')[-1] in ('events','resources','competitions','projects','programs') else 'detail'
                source = dict(url=url, discovery_groups=[self.group], role=role, stage='candidate',
                              source_type=self.source_type(url), enabled=False, notes='',
                              provenance=[dict(method='internal_link', source_url=parent, observed_at=now)])
                parent_source = self.sources.get(parent, {})
                if parent_source.get('source_family') == 'student_orgs':
                    for field in ('source_family','organization','affiliation_catalog_url'):
                        if field in parent_source:
                            source[field] = parent_source[field]
                self.data['sources'].append(source)
                self.sources[url] = source
            else:
                source = self.sources[url]
                if self.group not in source['discovery_groups']:
                    source['discovery_groups'].append(self.group)
                if not any(p.get('source_url') == parent for p in source['provenance']):
                    source['provenance'].append(dict(method='internal_link', source_url=parent, observed_at=now))
        return selected


def run_registry(data, output_dir, groups=GROUPS, pages_per_group=3, max_depth=1,
                 database=None, runner=run_collection, mode='discover', source_family=None, organization=None):
    if not groups or not set(groups) <= CATEGORIES or not 1 <= pages_per_group <= 100 or not 0 <= max_depth <= 5:
        raise ValueError('Invalid discovery groups or budgets')
    if mode not in ('discover', 'monitor'):
        raise ValueError('Invalid registry mode')
    output_dir = Path(output_dir)
    reports = {}
    for group in dict.fromkeys(groups):
        policy = DiscoveryPolicy(data, group)
        seeds = [s['url'] for s in data['sources'] if group in s['discovery_groups'] and s['enabled']
                 and (source_family is None or s.get('source_family') == source_family)
                 and (organization is None or organization.casefold() in s.get('organization','').casefold())
                 and (s['role'] == 'directory' and s['stage'] == 'seed' if mode == 'discover'
                      else s['role'] == 'detail' and s['stage'] in ('collected', 'source_reviewed', 'seed'))]
        if not seeds:
            reports[group] = {'coverage_gap': 'no_enabled_sources', 'websites_checked': 0, 'errors': []}
            continue
        available_seeds = len(seeds)
        if mode == 'discover':
            # One directory per group leaves budget for its children; rotate on
            # subsequent runs instead of spending every request on more roots.
            cursors = data.setdefault('discovery_cursors', {})
            cursor_key = (source_family or 'all') + ':' + group
            cursor = cursors.get(cursor_key, 0)
            seeds = [seeds[cursor % len(seeds)]]
            cursors[cursor_key] = cursor + 1
        report = runner(seeds, output_dir/'state.json', output_dir/'opportunities.json',
                        discover=mode == 'discover', max_pages=pages_per_group, max_depth=max_depth,
                        database=database, discovery_policy=policy)
        report['seed_urls'] = seeds
        report['available_seed_count'] = available_seeds
        report['discovery_provenance'] = policy.observed
        # Count actual extracted categories, never relabel a program as internship
        # simply because its parent was an internship directory.
        state = json.loads((output_dir/'state.json').read_text(encoding='utf-8'))
        checked = {p['url'] for p in report['pages']}
        rows = [r for url, entry in state['pages'].items() if url in checked and not entry.get('error') for r in entry.get('records', [])]
        report['observed_record_categories'] = dict(Counter(r['category'] for r in rows))
        for source in data['sources']:
            if source['url'] in checked:
                entry = state['pages'][source['url']]
                source['last_checked_at'] = entry.get('last_checked_at')
                source['last_error'] = entry.get('error')
                if entry.get('records') and not entry.get('error') and source['stage'] == 'candidate':
                    source.update(stage='collected', enabled=True)
        reports[group] = report
        atomic_json(output_dir/'report.json', {'groups': reports})
    state_path = output_dir/'state.json'
    state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'pages': {}}
    rows = [r for entry in state['pages'].values() for r in entry.get('records', [])]
    return {'groups': reports, 'record_categories': dict(Counter(r['category'] for r in rows)),
            'total_local_records': len(rows), 'external_candidates': len(data['external_candidates']),
            'pages_per_group': pages_per_group,
            'note': 'Discovery budgets are category-specific; resulting record categories are content-based.'}


def export_lists(data, directory=ROOT):
    """Compatibility inputs are generated views; maintain metadata in the registry."""
    directory = Path(directory)
    views = {'sources.json': lambda s: s['stage'] == 'seed',
             'reviewed_sources.json': lambda s: s['stage'] == 'source_reviewed',
             'candidate_sources.json': lambda s: s['stage'] == 'candidate'}
    for name, select in views.items():
        atomic_json(directory/name, [s['url'] for s in data['sources'] if select(s)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--registry', type=Path, default=ROOT/'source_registry.json')
    parser.add_argument('--groups', default=','.join(GROUPS))
    parser.add_argument('--pages-per-group', type=int, default=3)
    parser.add_argument('--max-depth', type=int, default=1)
    parser.add_argument('--mode', choices=('discover', 'monitor'), default='discover')
    parser.add_argument('--output-dir', type=Path, default=ROOT/'output/registry')
    parser.add_argument('--ingest', action='store_true')
    parser.add_argument('--source-family', choices=('all','student_orgs'), default='all')
    parser.add_argument('--organization', help='Filter registry sources by organization name')
    parser.add_argument('--export-lists', action='store_true', help='Only regenerate legacy flat input lists')
    args = parser.parse_args()
    try:
        load_env(ROOT/'.env')
        data = load_registry(args.registry)
        if args.export_lists:
            export_lists(data)
            print(json.dumps({'exported': True, 'registry_sources': len(data['sources'])}))
            return
        groups = [group.strip() for group in args.groups.split(',')]
        if not groups or not set(groups) <= CATEGORIES:
            raise ValueError('Unknown discovery group')
        for key in ('BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE', 'GEMINI_API_KEY', 'GEMINI_MODEL'):
            if not os.environ.get(key):
                raise ValueError('Missing provider setting')
        store = ApiStore(os.environ.get('COLLECTOR_API_BASE_URL', DEFAULT_BASE)) if args.ingest else None
        report = run_registry(data, args.output_dir, groups, args.pages_per_group, args.max_depth, store, mode=args.mode,
                              source_family=None if args.source_family=='all' else args.source_family,
                              organization=args.organization)
        atomic_json(args.registry, data)
        export_lists(data)
        atomic_json(args.output_dir/'report.json', report)
        summary = dict(report, groups={group: {key: value for key, value in result.items()
                       if key in ('websites_checked', 'pages_retrieved', 'records_found', 'inserted',
                                  'updated', 'rejected', 'errors', 'observed_record_categories', 'coverage_gap')}
                       for group, result in report['groups'].items()})
        print(json.dumps(summary), flush=True)
        if any(r['errors'] for r in report['groups'].values()):
            raise SystemExit(1)
    except KeyboardInterrupt:
        parser.exit(1, 'Registry run interrupted; per-page state is retained.\n')
    except Exception as error:
        parser.exit(1, 'Registry run failed: ' + error_code(error) + '\n')


if __name__ == '__main__':
    main()
