// Read-aloud script rules. Run: node --experimental-strip-types tests/speech.test.mts
import assert from "node:assert/strict";
import { MAX_SPEECH_CHARS, speechScript } from "../lib/speech.ts";

const base = {
  title: "Faculty Mentor Program (FMP)", organization: "Undergraduate Research Hub", deadline: "2026-12-18",
  deadline_text: "12/18/2026*", application_method: "Apply via the portal at https://ugresearch.ucsd.edu/apply", status: "needs_verification",
  eligibility: [{ raw_text: "Have a minimum GPA of 2.7 at the beginning of the program (Winter Quarter).", is_hard_requirement: true }],
  access: { international: { value: "open", quote: "International ... are all eligible" }, compensation: { value: "credit", quote: "4 units" } },
};
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ok ", name); };
t("speaks the date in words", () => assert.match(speechScript(base), /December 18, 2026/));
t("never reads a URL aloud", () => assert.ok(!/https?:/.test(speechScript(base))));
t("quotes requirements as written", () => assert.match(speechScript(base), /minimum GPA of 2\.7/));
t("silence about international students is said out loud", () => {
  const s = speechScript({ ...base, access: {} });
  assert.match(s, /does not say whether international students can apply/);
});
t("unverified listings say so", () => assert.match(speechScript(base), /Nobody has checked/));
t("stays under the length cap", () => {
  const long = { ...base, eligibility: Array.from({ length: 40 }, (_, i) => ({ raw_text: `Requirement number ${i} `.repeat(10), is_hard_requirement: true })) };
  assert.ok(speechScript(long).length <= MAX_SPEECH_CHARS);
});
console.log(`\n${n} speech tests passed`);
console.log("\nSample:\n" + speechScript(base));
