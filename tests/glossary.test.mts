// Glossary matching. Run: node --experimental-strip-types tests/glossary.test.mts
import assert from "node:assert/strict";
import { GLOSSARY, assignTerms, findTerms, termsIn } from "../lib/glossary.ts";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ok ", name); };
const names = (s: string) => termsIn(s).map((x) => x.term);

t("every term has a definition and a unique name", () => {
  assert.equal(new Set(GLOSSARY.map((x) => x.term)).size, GLOSSARY.length);
  for (const x of GLOSSARY) assert.ok(x.text.length > 20, x.term);
});
t("real listing text: PSYC 199 + GPA + TEA", () => {
  const s = "Prerequisites for PSYC-199: Upper-division standing, completion of at least 90 units with a minimum UCSD GPA of 2.5; completed and approved Triton Enrollment Authorization (TEA) request.";
  for (const w of ["99 / 199", "GPA", "TEA", "Units", "Prerequisite", "Standing"]) assert.ok(names(s).includes(w), w);
});
t("no false hits on years, zip codes or prices", () => {
  assert.deepEqual(names("Founded 1999 in La Jolla, CA 92093. Fee: $1,990."), []);
});
t("'REAL' and 'TEA' only match in capitals", () => {
  assert.ok(!names("a real chance to drink tea").includes("REAL portal"));
  assert.ok(!names("a real chance to drink tea").includes("TEA"));
});
t("each word is explained once across a listing, at first use", () => {
  const a = "Minimum GPA of 3.0";
  const b = "Email the PI with your GPA and CV";
  const m = assignTerms([a, b]);
  assert.deepEqual([...m.get(a)!], ["GPA"]);
  assert.deepEqual([...m.get(b)!].sort(), ["CV", "PI"]);
});
t("matches never overlap", () => {
  const hits = findTerms("upper-division standing in the honors program, 199 units");
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].start >= hits[i - 1].end);
});
console.log(`\n${n} glossary tests passed`);
