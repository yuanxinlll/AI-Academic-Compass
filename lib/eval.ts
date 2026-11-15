import { createHash } from "node:crypto";

// What a reviewer checks against the source page, per listing.
export const EVAL_FIELDS = [
  { key: "title", label: "Title and organizer", verdicts: ["correct", "wrong"] },
  { key: "category", label: "Category", verdicts: ["correct", "wrong"] },
  { key: "deadline", label: "Deadline", verdicts: ["correct", "wrong", "missing", "na"] },
  { key: "requirements_complete", label: "Every hard requirement captured", verdicts: ["correct", "missing"] },
  { key: "requirement_quotes", label: "Requirement quotes and required/preferred", verdicts: ["correct", "wrong", "na"] },
  { key: "apply_method", label: "How to apply", verdicts: ["correct", "wrong", "missing", "na"] },
  { key: "international", label: "International eligibility", verdicts: ["correct", "wrong", "missing", "na"] },
] as const;

/** Fixed before labeling: ~3 in 8 listings tune prompts (dev), the rest are only scored (test). */
export function splitFor(id: string): "dev" | "test" {
  return parseInt(createHash("md5").update(id).digest("hex")[0], 16) < 6 ? "dev" : "test";
}
