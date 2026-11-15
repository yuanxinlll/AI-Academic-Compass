// Export listings + their extracted fields for review: node scripts/export-eval.mjs [n]
// Writes collector/output/eval_export.json (git-ignored). Split matches lib/eval.ts.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const n = Number(process.argv[2] ?? 25);
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query(
  `SELECT opportunity_id, title, organization, category, deadline::text AS deadline, deadline_text,
          application_method, eligibility, access, source_url, source_kind
     FROM opportunities ORDER BY first_collected_at`,
);
const split = (id) => (parseInt(createHash("md5").update(id).digest("hex")[0], 16) < 6 ? "dev" : "test");
const test = rows.map((r) => ({ ...r, split: split(r.opportunity_id) })).filter((r) => r.split === "test").slice(0, n);
mkdirSync("collector/output", { recursive: true });
writeFileSync("collector/output/eval_export.json", JSON.stringify(test, null, 2));
console.log(`wrote ${test.length} test-set listings (of ${rows.length} total) to collector/output/eval_export.json`);
