// Fill `deadline` from an already-stored `deadline_text` quote when that quote holds exactly one complete date.
// Same rule as collector/validation.py single_date(): any date without a year makes the quote ambiguous, so it is skipped.
//   node scripts/backfill-deadlines.mjs            # report only
//   node scripts/backfill-deadlines.mjs --apply    # write the dates (past dates also mark the listing expired)
import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = MONTHS.map((m) => `${m}|${m.slice(0, 3)}\\.?`).join("|");

function iso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function singleDate(text) {
  if (!text) return null;
  const found = new Set();
  let mentions = 0;
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    mentions++;
    const v = iso(+m[1], +m[2], +m[3]);
    if (!v) return null;
    found.add(v);
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    mentions++;
    if (!m[3] || m[3].length !== 4) return null;
    const v = iso(+m[3], +m[1], +m[2]);
    if (!v) return null;
    found.add(v);
  }
  for (const m of text.matchAll(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(,?\\s+(\\d{4})\\b)?`, "gi"))) {
    mentions++;
    if (!m[4]) return null;
    const month = MONTHS.findIndex((n) => m[1].toLowerCase().startsWith(n.slice(0, 3))) + 1;
    const v = iso(+m[4], month, +m[2]);
    if (!v) return null;
    found.add(v);
  }
  return mentions && found.size === 1 ? [...found][0] : null;
}

const rows = await sql.query(
  `SELECT opportunity_id, title, status, deadline_text FROM opportunities
    WHERE deadline IS NULL AND deadline_text IS NOT NULL ORDER BY title`,
);
const today = new Date().toISOString().slice(0, 10);
let n = 0;
for (const r of rows) {
  const d = singleDate(r.deadline_text);
  console.log(`${d ? `  ${d}` : "  skip      "}  ${r.title}\n              “${r.deadline_text.slice(0, 110)}”`);
  if (!d) continue;
  n++;
  if (apply) {
    const expire = d < today && r.status === "needs_verification";
    await sql.query(
      `UPDATE opportunities SET deadline = $2, status = CASE WHEN $3 THEN 'expired' ELSE status END WHERE opportunity_id = $1`,
      [r.opportunity_id, d, expire],
    );
  }
}
console.log(`\n${rows.length} listings have a quote but no date; ${n} can be filled.${apply ? " Applied." : " Dry run; add --apply to write."}`);
