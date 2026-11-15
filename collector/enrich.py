"""Fill gaps with an AI web search — as unverified LEADS, never as facts.

For open listings that do not say a deadline or whether international students can apply,
Gemini (with Google Search grounding) proposes official pages that might. We then fetch each
proposed page ourselves through Bright Data and keep a lead ONLY if its quote is really on that
page. Leads are shown to students as "Found elsewhere — unverified" with the link, and are
never used for eligibility.

    python -m collector.enrich --limit 15
"""
import argparse
import json
import os
import time
from pathlib import Path
from urllib.parse import urlsplit

from collector.access import _api
from collector.main import fetch_page
from collector.text import evidence_in, parse_page

FIELDS = {'deadline', 'eligibility', 'application_method', 'compensation', 'international'}

PROMPT = '''Search the web for OFFICIAL information about this opportunity for UC San Diego undergraduates.
Title: {title}
Organizer: {org}
Listing page: {url}
Missing from the listing: {missing}
Return ONLY a JSON array (no prose) of at most 4 objects:
{{"field": one of deadline|eligibility|application_method|compensation|international,
  "value": short plain answer,
  "url": the exact page URL where you found it (prefer ucsd.edu or the organizer's site; not the listing page),
  "quote": an exact sentence copied from that page that states it}}
If you cannot find something with an exact quote, leave it out. Never guess.'''


def missing_fields(o):
    out = []
    if not o.get('deadline') and not o.get('deadline_text'):
        out.append('application deadline')
    if (o.get('access') or {}).get('international', {}).get('value', 'unstated') == 'unstated':
        out.append('whether international (F-1) students can apply')
    if not o.get('application_method'):
        out.append('how to apply')
    return out


def enrich(limit=15):
    from collector.gemini import generate
    items = _api('GET', '/api/opportunities?limit=100')['items']
    report = {'checked': 0, 'proposed': 0, 'kept': 0, 'rejected_no_quote': 0, 'errors': []}
    for o in [i for i in items if missing_fields(i)][:limit]:
        report['checked'] += 1
        try:
            proposals = generate([{'text': PROMPT.format(title=o['title'], org=o.get('organization') or 'unknown',
                                                         url=o['source_url'], missing='; '.join(missing_fields(o)))}],
                                 search=True)
        except Exception as error:
            report['errors'].append({'title': o['title'], 'error': type(error).__name__})
            continue
        leads = []
        for p in proposals if isinstance(proposals, list) else []:
            if not isinstance(p, dict) or p.get('field') not in FIELDS:
                continue
            url, quote = p.get('url'), p.get('quote')
            if not isinstance(url, str) or urlsplit(url).scheme != 'https' or url.rstrip('/') == o['source_url'].rstrip('/'):
                continue
            report['proposed'] += 1
            try:
                page, _ = parse_page(fetch_page(url), url)
            except Exception:
                report['rejected_no_quote'] += 1
                continue
            if not evidence_in(quote, page):  # the model's quote must really be on the page
                report['rejected_no_quote'] += 1
                continue
            leads.append({'field': p['field'], 'value': str(p.get('value') or '')[:500] or quote[:200],
                          'quote': quote.strip()[:1000], 'evidence_url': url, 'found_by': 'gemini_search'})
        if leads:
            _api('POST', '/api/admin/leads', {'opportunity_id': o['opportunity_id'], 'leads': leads})
            report['kept'] += len(leads)
            print(f"  +{len(leads)} lead(s)  {o['title'][:70]}", flush=True)
        else:
            print(f"  none      {o['title'][:70]}", flush=True)
        time.sleep(0.5)
    return report


def main():
    from collector.pipeline import load_env
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--limit', type=int, default=15)
    parser.add_argument('--env-file', type=Path, default=Path(__file__).parent / '.env')
    args = parser.parse_args()
    load_env(args.env_file)
    for key in ('BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'ADMIN_TOKEN'):
        if not os.environ.get(key):
            raise SystemExit('Missing setting: ' + key)
    print(json.dumps(enrich(args.limit), indent=2))


if __name__ == '__main__':
    main()
