"""Verify organization-owned destinations attested by UCSD public directories."""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from difflib import SequenceMatcher
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from collector.pipeline import ROOT, atomic_json
from collector.student_orgs import clean, read
from collector.text import PageParser

ATTESTATIONS = (
 'https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate',
 'https://rady.ucsd.edu/programs/undergraduate/resources/radyvantage.html',
 'https://biology.ucsd.edu/education/undergrad/student-org/index.html',
 'https://economics.ucsd.edu/undergraduate-program/resources/student-organizations/index.html',
)


# Online-search leads reviewed against the current CSI identity and official-site
# self-description/cross-links. Searching a name alone never enables a source.
SEARCHED_SOURCES = (
 ('21095', 'https://designatucsd.com/', 'https://designatucsd.com/contact'),
 ('21366', 'https://wicucsd.vercel.app/', 'https://jacobsschool.ucsd.edu/idea/current-undergraduates/undergraduate'),
 ('20905', 'https://ai.acmucsd.com/competitions', 'https://acmucsd.com/about'),
)


def approved_scopes(source):
    scopes=[]
    if not source.get('fetch_enabled') or source['kind'] != 'website':
        return scopes
    for url in (source['url'],source.get('final_url',source['url'])):
        parsed=urlsplit(url)
        if not parsed.hostname or parsed.hostname in ('www.instagram.com','instagram.com','accounts.google.com'):
            continue
        path=parsed.path or '/'
        if parsed.hostname.endswith('.ucsd.edu'):
            # Existing university policy already admits this host; no need to
            # declare an institution-wide organization ownership scope.
            prefix=path
        elif parsed.hostname.endswith('.wixsite.com') or parsed.hostname in ('sites.google.com','linktr.ee'):
            prefix=path.rstrip('/')
        else:
            prefix='/'
        scope={'hostname':parsed.hostname,'path_prefix':prefix}
        if scope not in scopes:scopes.append(scope)
    return scopes


class OrganizationLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.heading = ''
        self.in_heading = False
        self.href = None
        self.label = ''
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'footer' or 'footer' in (attrs.get('class', '') + attrs.get('id', '')).casefold():
            self.heading = ''
        if tag in ('h2', 'h3', 'h4'):
            self.in_heading = True
            self.heading = ''
        if tag == 'a' and attrs.get('href'):
            self.href, self.label = attrs['href'], ''

    def handle_data(self, text):
        if self.in_heading:
            self.heading += text
        if self.href:
            self.label += text

    def handle_endtag(self, tag):
        if tag in ('h2', 'h3', 'h4'):
            self.in_heading = False
        if tag == 'a' and self.href:
            self.rows.append((self.heading.strip(), self.label.strip(), self.href))
            self.href = None


def normalized(name):
    name = re.sub(r'\([^)]*\)', '', name.casefold())
    name = re.sub(r'at uc san diego|at ucsd|@ uc san diego|@ ucsd', '', name)
    name = re.sub(r'uc san diego|ucsd', '', name)
    return re.sub(r'[^a-z0-9]', '', name)


def match_organization(name, organizations):
    wanted = normalized(name)
    if len(wanted) < 4:
        return None
    def score(row):
        found = normalized(row['organization'])
        if wanted == found:
            return 1
        if min(len(wanted), len(found)) >= 8 and (wanted in found or found in wanted):
            return .95
        return SequenceMatcher(None, wanted, found).ratio()
    best = max(organizations, key=score)
    return best if score(best) >= .95 else None


def candidate(url, organization, attestation, kind=None):
    parsed = urlsplit(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
        return None
    host = parsed.hostname.lower()
    if any(host == h or host.endswith('.'+h) for h in ('facebook.com', 'linkedin.com', 'discord.gg', 'youtube.com', 'twitter.com', 'x.com', 'urldefense.com', 'urldefense.proofpoint.com')):
        return None
    if host in ('ucsd.edu', 'www.ucsd.edu') or re.search(r'/about/|/privacy|/terms|/signup|/forms/', parsed.path):
        return None
    kind = kind or ('instagram' if host in ('instagram.com', 'www.instagram.com') else 'website')
    return dict(url=urlunsplit(('https',host,parsed.path or '/',parsed.query,'')), kind=kind,
                organization=organization['organization'], directory_url=organization['directory_url'],
                registration_status=organization.get('registration_status'),
                affiliation_evidence=[attestation], verification_status='pending', fetch_enabled=False)


def inspect(source):
    source = dict(source, checked_at=datetime.now(timezone.utc).isoformat())
    try:
        with urlopen(Request(source['url'],headers={'User-Agent':'AcademicCompass-SourceReview/1.0'}),timeout=15) as response:
            html = response.read(2000000).decode('utf-8',errors='replace')
            end = urlsplit(response.url)
            final = urlunsplit((end.scheme, end.netloc, end.path, '', ''))
            status = response.status
        parser=PageParser();parser.feed(html)
        text=' '.join(parser.parts)
        title=re.search(r'<title[^>]*>(.*?)</title>',html,re.S|re.I)
        source.update(http_status=status,final_url=final,observed_title=clean(title[1])[:200] if title else None)
        login=bool(re.search(r'log in.*instagram|login.*instagram|accounts/login|accounts.google.com',text+' '+final,re.I))
        parked=bool(re.search(r'domain (?:is )?for sale|buy this domain|domain has expired|hugedomains|account suspended|temporarily offline|coming soon',text,re.I))
        source['identity_status']='listed_by_ucsd_directory'
        if source['kind']=='instagram':
            # A generic login/consent HTML page is not evidence of a readable profile/feed.
            handle=urlsplit(source['url']).path.strip('/').split('/')[0]
            title_text=source.get('observed_title') or ''
            if '@'+handle.casefold() in title_text.casefold() and '/accounts/' not in final:
                source.update(access_status='public_profile_metadata_only',
                              verification_status='verified_ucsd_affiliated_source',
                              post_access_status='not_verified')
            else:
                source['access_status']='login_or_render_required'
        elif parked or login:
            source['access_status']='unrelated_or_login_page'
        elif len(text.strip())<120:
            source['access_status']='render_required'
        elif not re.search(r'ucsd|uc san diego|university of california.{0,30}san diego',text,re.I):
            source['access_status']='identity_needs_review'
        else:
            source.update(access_status='public_content',verification_status='verified_ucsd_affiliated_source',
                          fetch_enabled=True)
            source['identity_evidence']='Linked from UCSD organization/department directory; public page identifies UCSD.'
        source['observed_instagram_links']=sorted({urljoin(final,u) for u in parser.links
             if urlsplit(urljoin(final,u)).hostname in ('instagram.com','www.instagram.com')})
    except Exception as error:
        source['access_status']='http_'+str(error.code) if hasattr(error,'code') else 'unavailable'
    source['approved_scopes']=approved_scopes(source)
    return source


def sync_registry(catalog, path=ROOT/'source_registry.json'):
    registry=json.loads(Path(path).read_text(encoding='utf-8'))
    existing={source['url']:source for source in registry['sources']}
    active={}
    for source in catalog['sources']:
        if not source.get('fetch_enabled'):
            continue
        url=source.get('final_url') or source['url']
        active[url]=source
        if url not in existing:
            existing[url]=dict(url=url,discovery_groups=['event','internship','competition','course'],
                role='directory',stage='seed',source_type='listing',enabled=True,
                provenance=[dict(method='verified_student_org_source',source_url=source['directory_url'])],
                notes='Verified source identity only; validate each opportunity independently.')
            registry['sources'].append(existing[url])
        existing[url].update(source_family='student_orgs',affiliation_catalog_url=source['url'],
                             organization=source['organization'],enabled=True,policy_status='approved')
    for source in registry['sources']:
        from collector.source_policy import approved_org_url
        if source.get('source_family')=='student_orgs' and not approved_org_url(source['url'],catalog):
            source.update(enabled=False,policy_status='not_currently_approved')
    atomic_json(path,registry)
    from collector.registry import export_lists
    export_lists(registry,Path(path).parent)


def main():
    directory=json.loads((ROOT/'output/student-org-directory.json').read_text(encoding='utf-8'))
    organizations=directory['organizations']
    found={}
    for url in ATTESTATIONS:
        parser=OrganizationLinks();parser.feed(read(url))
        for heading,label,href in parser.rows:
            organization=match_organization(heading,organizations)
            if not organization:
                continue
            target=urljoin(url,href)
            parsed=urlsplit(target)
            # Explicit website/Instagram labels or external links in an organization section.
            if label.lower() not in ('website','instagram') and (not parsed.hostname or parsed.hostname.endswith('.ucsd.edu')):
                continue
            row=candidate(target,organization,url)
            if row and not re.search(r'\.(?:jpg|png|svg|pdf)$',parsed.path,re.I):
                if row['url'] in found:
                    found[row['url']]['affiliation_evidence'].append(url)
                else:
                    found[row['url']]=row
    for organization in organizations:
        for url in re.findall(r'https?://[^\s<>]+',organization.get('social_media','')):
            row=candidate(url.rstrip('.,;)'),organization,organization['directory_url'])
            if row:
                found.setdefault(row['url'],row)
    for record_id,url,evidence in SEARCHED_SOURCES:
        organization=next(row for row in organizations if row['directory_url'].endswith('/'+record_id))
        row=candidate(url,organization,evidence)
        if row:
            row['affiliation_evidence'].append(organization['directory_url'])
            found.setdefault(row['url'],row)
    with ThreadPoolExecutor(max_workers=4) as pool:
        checked=list(pool.map(inspect,found.values()))
    catalog=dict(version=1,checked_at=datetime.now(timezone.utc).isoformat(),
                 directory_url=directory['directory_url'],directory_count=directory['directory_count'],
                 directory_records_checked=directory['records_checked'],sources=checked,
                 note='Source affiliation/access verification is separate from opportunity verification. Registered student organizations are independent entities, not official university units.')
    represented={source['directory_url'] for source in checked}
    catalog['unresolved_social_references']=[dict(organization=row['organization'],
        directory_url=row['directory_url'],reference=row['social_media'],status='needs_identity_and_access_check')
        for row in organizations if row.get('social_media') and row['directory_url'] not in represented]
    atomic_json(ROOT/'student_org_sources.json',catalog)
    sync_registry(catalog)
    print(json.dumps({'candidates_checked':len(checked),'verified_websites':sum(s['fetch_enabled'] for s in checked),
                      'instagram_candidates':sum(s['kind']=='instagram' for s in checked)}))


if __name__=='__main__':
    main()
