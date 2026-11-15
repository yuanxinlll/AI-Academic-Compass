"""Small, resumable Instagram post probe for UCSD-attested organization accounts."""
import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from collector.pipeline import ROOT, atomic_json, load_env

DATASET = 'gd_lk5ns7kz21pck8jpis'
BASE = 'https://api.brightdata.com/datasets/v3/'


def profile_handle(value):
    if value.startswith('https://'):
        parsed=urlsplit(value)
        if parsed.hostname not in ('instagram.com','www.instagram.com') or parsed.username or parsed.password:
            raise ValueError('Invalid Instagram profile')
        value=parsed.path.strip('/')
    value=value.lstrip('@').casefold()
    if not re.fullmatch(r'[a-z0-9._]{1,30}',value) or value in ('p','reel','reels','accounts','explore'):
        raise ValueError('Invalid Instagram handle')
    return value


def attested_source(handle, catalog):
    handle=profile_handle(handle)
    for source in catalog['sources']:
        if source['kind']=='instagram' and profile_handle(source['url'])==handle:
            if (source.get('registration_status')=='Current' and
                    source['directory_url'].startswith('https://studentorg.ucsd.edu/Home/Details/') and
                    source.get('affiliation_evidence')):
                return source
    raise ValueError('Use a current UCSD-attested organization account')


def clean_posts(rows, handle, limit=3):
    handle=profile_handle(handle)
    if not 1 <= limit <= 3 or not isinstance(rows,list):
        raise ValueError('Invalid bounded post result')
    posts=[]
    seen=set()
    for row in rows:
        if row.get('error') or row.get('error_code'):
            continue
        actor=(row.get('user_posted') or row.get('account') or '').lstrip('@').casefold()
        coauthors=[]
        for author in row.get('coauthor_producers') or []:
            name=author.get('username') if isinstance(author,dict) else author
            if isinstance(name,str):coauthors.append(name.lstrip('@').casefold())
        # Being tagged or discovered from a profile is not authorship evidence.
        if handle != actor and handle not in coauthors:
            continue
        parsed=urlsplit(row.get('url',''))
        if (parsed.scheme!='https' or parsed.hostname not in ('www.instagram.com','instagram.com') or
                not re.fullmatch(r'/(?:p|reel|tv)/[A-Za-z0-9_-]+/?',parsed.path)):
            continue
        url='https://www.instagram.com'+parsed.path.rstrip('/')+'/'
        if url in seen:continue
        seen.add(url)
        caption=row.get('description') or row.get('caption') or ''
        if not isinstance(caption,str):raise ValueError('Invalid caption')
        posted=row.get('date_posted')
        if posted:
            parsed_date=datetime.fromisoformat(posted.replace('Z','+00:00'))
            if parsed_date.tzinfo is None:raise ValueError('Post date needs a timezone')
        posts.append(dict(source_url=url,publisher=actor,verified_source_account=handle,
                          coauthors=coauthors,caption=caption,posted_at=posted,
                          image_count=len(row.get('photos') or [])))
        if len(posts)==limit:break
    return posts


class InstagramClient:
    def __init__(self, api_key):
        if not api_key:raise ValueError('BRIGHTDATA_API_KEY is required')
        self.api_key=api_key

    def request(self,path,payload=None):
        request=Request(BASE+path,headers={'Authorization':'Bearer '+self.api_key,
            'Content-Type':'application/json'},data=json.dumps(payload).encode() if payload is not None else None)
        try:
            with urlopen(request,timeout=30) as response:return json.load(response)
        except HTTPError as error:
            code=error.code;error.close()
            raise RuntimeError('instagram_http_'+str(code)) from None
        except (URLError,TimeoutError,OSError):
            raise RuntimeError('instagram_network_error') from None

    def trigger(self,handle,limit=3):
        if not 1 <= limit <= 3:raise ValueError('Limit must be 1..3')
        handle=profile_handle(handle)
        # No automatic POST retry: a lost response must not create duplicate paid jobs.
        return self.request('trigger?dataset_id='+DATASET+
            '&notify=false&include_errors=true&type=discover_new&discover_by=url&format=json',
            {'input':[{'url':'https://www.instagram.com/'+handle+'/','num_of_posts':limit}],
             'limit_per_input':limit})['snapshot_id']

    def progress(self,snapshot):
        if not re.fullmatch(r'sd_[A-Za-z0-9]+',snapshot):raise ValueError('Invalid snapshot ID')
        return self.request('progress/'+snapshot)

    def download(self,snapshot):
        if not re.fullmatch(r'sd_[A-Za-z0-9]+',snapshot):raise ValueError('Invalid snapshot ID')
        return self.request('snapshot/'+snapshot+'?format=json')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',default='ds3atucsd')
    parser.add_argument('--limit',type=int,choices=(1,2,3),default=3)
    parser.add_argument('--snapshot-id',help='Resume an existing job instead of creating a new one')
    parser.add_argument('--wait-seconds',type=int,default=180)
    args=parser.parse_args()
    try:
        if not 0 <= args.wait_seconds <= 600:raise ValueError('Wait must be 0..600 seconds')
        load_env(ROOT/'.env')
        handle=profile_handle(args.profile)
        catalog=json.loads((ROOT/'student_org_sources.json').read_text(encoding='utf-8'))
        source=attested_source(handle,catalog)
        client=InstagramClient(os.environ.get('BRIGHTDATA_API_KEY'))
        snapshot=args.snapshot_id or client.trigger(handle,args.limit)
        folder=ROOT/'output/instagram-probe'/handle
        atomic_json(folder/'job.json',dict(snapshot_id=snapshot,profile=handle,limit=args.limit))
        deadline=time.monotonic()+args.wait_seconds
        while True:
            progress=client.progress(snapshot)
            atomic_json(folder/'progress.json',progress)
            status=progress.get('status')
            if status=='ready':break
            if status not in ('running','starting'):
                raise RuntimeError('instagram_job_'+str(status))
            if time.monotonic()>=deadline:
                print(json.dumps({'status':status,'snapshot_id':snapshot,'resume_with':'--snapshot-id '+snapshot}))
                return
            time.sleep(min(5,max(0,deadline-time.monotonic())))
        posts=clean_posts(client.download(snapshot),handle,args.limit)
        atomic_json(folder/'posts.json',posts)
        if posts:
            source.update(scraper_enabled=True,scraper_access_status='public_posts_retrieved',
                          scraper_last_verified_at=datetime.now(timezone.utc).isoformat(),
                          verified_post_urls=[post['source_url'] for post in posts],
                          verification_status='verified_ucsd_affiliated_source')
            # fetch_enabled remains false: the website HTML transport is separate.
            atomic_json(ROOT/'student_org_sources.json',catalog)
        print(json.dumps({'status':'ready','profile':handle,'validated_posts':len(posts),
                          'posts':[{'url':p['source_url'],'publisher':p['publisher'],
                                    'posted_at':p['posted_at'],'image_count':p['image_count']} for p in posts],
                          'database_writes':0}))
    except Exception as error:
        parser.exit(1,'Instagram probe failed: '+type(error).__name__+'\n')


if __name__=='__main__':
    main()
