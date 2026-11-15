"""Save the source text of each exported eval listing, for side-by-side review.

    python3 -m collector.fetch_for_eval
Reads collector/output/eval_export.json, writes collector/output/eval_pages/NN.txt (git-ignored).
Uses Bright Data only (no Gemini).
"""
import json
from pathlib import Path

from collector.main import fetch_page
from collector.pipeline import load_env
from collector.text import parse_page

ROOT = Path(__file__).parent
load_env(ROOT / '.env')
items = json.loads((ROOT / 'output/eval_export.json').read_text(encoding='utf-8'))
out = ROOT / 'output/eval_pages'
out.mkdir(parents=True, exist_ok=True)
for i, o in enumerate(items, 1):
    try:
        text, _ = parse_page(fetch_page(o['source_url']), o['source_url'])
        (out / f'{i:02d}.txt').write_text(o['source_url'] + '\n\n' + text, encoding='utf-8')
        print(f'  ok  {i:02d} {o["title"][:60]}  ({len(text)} chars)', flush=True)
    except Exception as error:
        print(f'  ERR {i:02d} {o["title"][:60]}  {type(error).__name__}', flush=True)
