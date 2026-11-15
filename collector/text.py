"""Readable source text and conservative UCSD link discovery."""
import re
import unicodedata
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

def canonical_url(url):
    if not isinstance(url, str) or len(url) > 2000 or any(c.isspace() or ord(c) < 32 for c in url):
        raise ValueError('Invalid public source URL')
    parsed = urlsplit(url)
    from collector.source_policy import approved_org_url
    university_host = parsed.hostname and (parsed.hostname == 'ucsd.edu' or parsed.hostname.endswith('.ucsd.edu'))
    # Narrow exception for multimodal collection: single public Instagram posts only
    # (never profiles, search or login pages). Posts are read as caption + image.
    instagram_post = parsed.hostname == 'www.instagram.com' and bool(re.fullmatch(r'/(p|reel)/[A-Za-z0-9_-]+/?', parsed.path or ''))
    if (parsed.scheme != 'https' or not parsed.hostname
        or parsed.username or parsed.password or parsed.port not in (None, 443)
        or not (university_host or instagram_post or approved_org_url(url))):
        raise ValueError('Use a public HTTPS UCSD or explicitly approved organization source URL')
    return urlunsplit(('https', parsed.hostname, parsed.path or '/', parsed.query, ''))

def comparable(text):
    return ' '.join(unicodedata.normalize('NFKC', unescape(text)).split())

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.links = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.skip += 1
        if tag in ('p', 'li', 'tr', 'h1', 'h2', 'h3', 'div', 'br'):
            self.parts.append('\n')
        if tag == 'a' and not self.skip:
            href = dict(attrs).get('href')
            if href:
                self.links.append(href)
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.skip = max(0, self.skip - 1)
        if tag in ('p', 'li', 'tr', 'h1', 'h2', 'h3', 'div'):
            self.parts.append('\n')
    def handle_data(self, text):
        if not self.skip:
            self.parts.append(text)

def parse_page(html, url):
    parser = PageParser()
    parser.feed(html)
    text = '\n'.join(filter(None, (comparable(line) for line in ''.join(parser.parts).splitlines())))
    links = []
    for href in parser.links:
        try:
            link = canonical_url(urljoin(url, href))
        except ValueError:
            continue
        if re.search(r'\.(pdf|jpg|png|gif|svg|zip|mp4|css|js)$', urlsplit(link).path, re.I):
            continue
        if link != canonical_url(url) and link not in links:
            links.append(link)
    # Neutral standalone ordering; registry runs apply group-specific priorities.
    links.sort(key=lambda link: (
        not bool(re.search(r'opportunit|opening|intern|event|seminar|workshop|lecture|'
                           r'compet|challenge|hackathon|course|training|program|research|join|apply',
                           urlsplit(link).path, re.I)), link))
    return text, links

def evidence_in(quote, page):
    return isinstance(quote, str) and bool(quote.strip()) and comparable(quote) in comparable(page)

def is_directory(url):
    """Known URH navigation pages are discovery sources, not opportunity records."""
    from urllib.parse import urlsplit
    parsed = urlsplit(url)
    return parsed.hostname == 'ugresearch.ucsd.edu' and parsed.path in {
        '/', '/index.html', '/programs/', '/programs/index.html',
        '/programs/urh-academic-year/index.html', '/programs/urh-summer/index.html',
        '/programs/all-urh-programs/index.html', '/programs/all-ucsd.html',
    }
