"""Offline final-contract demo; all records are fictional, no credentials needed."""

import json
from pathlib import Path

from contract_adapter import match_v11


if __name__ == '__main__':
    fixture = Path(__file__).resolve().parents[1] / 'examples' / 'match-request.json'
    request = json.loads(fixture.read_text())
    print(json.dumps(match_v11(request['profile'], request['opportunities']), indent=2))
