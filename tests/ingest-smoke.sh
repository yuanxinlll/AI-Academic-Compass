#!/usr/bin/env bash
# Smoke test for POST /api/admin/opportunities.
# Usage: bash tests/ingest-smoke.sh [base_url]   (default http://localhost:3000)
set -u
BASE="${1:-http://localhost:3000}"
URL="$BASE/api/admin/opportunities"
T=$(grep '^ADMIN_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')

BODY='{
  "source": {"website_url": "https://example.com/seed/source-test", "source_type": "lab_page"},
  "opportunities": [
    {"title":"Ingest Test RA","category":"research","source_url":"https://example.com/seed/ingest-test-1",
     "eligibility":[{"type":"hours_per_week","value":8,"raw_text":"8 hrs/week","is_hard_requirement":true}],
     "deadline":null,"deadline_text":"Rolling basis"},
    {"title":"Bad Date","category":"event","source_url":"https://example.com/seed/ingest-test-2","deadline":"2027-02-30"}
  ]}'

echo "== 1. no token (expect UNAUTHORIZED)"
curl -s -X POST "$URL" -H 'content-type: application/json' -d '{}'; echo; echo

echo "== 2. first submit (expect inserted 1 / rejected 1 on first ever run)"
curl -s -X POST "$URL" -H "x-admin-token: $T" -H 'content-type: application/json' -d "$BODY"; echo; echo

echo "== 3. same submit again (expect inserted 0 / updated 1)"
curl -s -X POST "$URL" -H "x-admin-token: $T" -H 'content-type: application/json' -d "$BODY"; echo
