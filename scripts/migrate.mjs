// Usage: node scripts/migrate.mjs lib/database/migrations/002_demo_accounts.sql
// Reads DATABASE_URL from the environment or .env.local. Runs each statement in order.
import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadEnv() {
  if (process.env.DATABASE_URL || !existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Splits SQL on top-level semicolons, keeping $$...$$ bodies, quotes and -- comments intact. */
function splitSql(text) {
  const out = [];
  let cur = "", i = 0, dollar = false, quote = false;
  while (i < text.length) {
    const c = text[i];
    if (!dollar && !quote && c === "-" && text[i + 1] === "-") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end + 1;
      cur += "\n";
      continue;
    }
    if (!quote && text.startsWith("$$", i)) { dollar = !dollar; cur += "$$"; i += 2; continue; }
    if (!dollar && c === "'") quote = !quote;
    if (!dollar && !quote && c === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

loadEnv();
const file = process.argv[2];
if (!file || !process.env.DATABASE_URL) {
  console.error("usage: node scripts/migrate.mjs <file.sql>  (needs DATABASE_URL)");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const statements = splitSql(readFileSync(file, "utf8"));
for (const [n, s] of statements.entries()) {
  await sql.query(s);
  console.log(`ok ${n + 1}/${statements.length}: ${s.split("\n")[0].slice(0, 70)}`);
}
