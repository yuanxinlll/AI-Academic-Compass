#!/usr/bin/env bash
# D → B integration smoke test (fictional data only).
# Usage: bash tests/ai-smoke.sh [base_url]   (default http://localhost:3000)
set -u
BASE="${1:-http://localhost:3000}"
U="x-demo-user: ai-smoke"

echo "== 1. save a fictional profile"
curl -s -X POST "$BASE/api/profile" -H "$U" -H 'content-type: application/json' -d '{
  "major":"Data Science","academic_year":"junior","interests":["AI","Biology"],
  "skills":["Python","pandas"],"selected_modules":["research","event"],"hours_per_week":12}' | head -c 200; echo; echo

echo "== 2. match all opportunities (expect HTTP 200 + results)"
curl -s -w '\nHTTP %{http_code}\n' -X POST "$BASE/api/match" -H "$U"
echo

echo "== 3. resume parse, use_ai=false (expect HTTP 200 + extracted)"
curl -s -w '\nHTTP %{http_code}\n' -X POST "$BASE/api/resume/parse" -H "$U" \
  -F "file=@tests/fixtures/fictional-resume.pdf;type=application/pdf" -F "use_ai=false"
