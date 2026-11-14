#!/usr/bin/env bash
# Human review helper.
#   bash tests/verify.sh list   [base_url]                 → records waiting for review
#   bash tests/verify.sh <uuid> <status> [base_url]        → set status (verified | needs_verification | expired)
set -u
T=$(grep '^ADMIN_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
if [ "${1:-}" = "list" ]; then
  BASE="${2:-http://localhost:3000}"
  curl -s "$BASE/api/opportunities?status=needs_verification&limit=100" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for o in d["items"]:
    print(o["opportunity_id"], "|", o["category"], "|", o["title"][:60], "|", o["source_url"])
print("total:", d["total"])'
  exit 0
fi
ID="${1:?usage: bash tests/verify.sh <uuid> <status> [base_url]}"
STATUS="${2:?status: verified | needs_verification | expired}"
BASE="${3:-http://localhost:3000}"
curl -s -w '\nHTTP %{http_code}\n' -X PATCH "$BASE/api/admin/opportunities/$ID" \
  -H "x-admin-token: $T" -H 'content-type: application/json' -d "{\"status\":\"$STATUS\"}"
