// Data cleanup before the demo. Dry run by default; add --apply to change the database.
//   node scripts/cleanup-data.mjs            # report only
//   node scripts/cleanup-data.mjs --apply    # delete seed/test rows, fix numeric requirement values
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

// 1. Seed / test listings: example.com URLs or "Seed Demo" organizations.
const junk = await sql.query(
  `SELECT opportunity_id, title, organization, source_url, status FROM opportunities
    WHERE source_url ~* '^https?://(www\\.)?example\\.(com|org)/' OR organization ILIKE 'seed demo%'
       OR title ILIKE '%[test]%' OR source_url ILIKE '%localhost%'
    ORDER BY title`,
);
console.log(`\n1) Seed/test listings: ${junk.length}`);
for (const r of junk) console.log(`   - ${r.title}  (${r.organization ?? "-"}, ${r.status})  ${r.source_url}`);

// 2. Requirement values that should be numbers (gpa, hours_per_week) but are text.
const rows = await sql.query(`SELECT opportunity_id, title, eligibility FROM opportunities`);
const fixes = [];
for (const r of rows) {
  let changed = false;
  const elig = (r.eligibility ?? []).map((e) => {
    if ((e.type === "gpa" || e.type === "hours_per_week") && typeof e.value === "string") {
      const m = e.value.match(/\d+(\.\d+)?/);
      const n = m ? Number(m[0]) : null;
      if (n !== null && Number.isFinite(n)) {
        changed = true;
        console.log(`   ${r.title}: ${e.type} "${e.value}" -> ${n}`);
        return { ...e, value: n };
      }
    }
    return e;
  });
  if (changed) fixes.push({ id: r.opportunity_id, elig });
}
console.log(`\n2) Listings with text gpa/hours values to convert: ${fixes.length}`);

if (!apply) {
  console.log("\nDry run. Nothing changed. Re-run with --apply to clean up.\n");
  process.exit(0);
}
if (junk.length) {
  await sql.query(`DELETE FROM opportunities WHERE opportunity_id = ANY($1::uuid[])`, [junk.map((r) => r.opportunity_id)]);
  console.log(`Deleted ${junk.length} seed/test listings (their bookmarks went with them).`);
}
for (const f of fixes) {
  await sql.query(`UPDATE opportunities SET eligibility = $2::jsonb WHERE opportunity_id = $1`, [f.id, JSON.stringify(f.elig)]);
}
console.log(`Converted values in ${fixes.length} listings.\nDone.\n`);
