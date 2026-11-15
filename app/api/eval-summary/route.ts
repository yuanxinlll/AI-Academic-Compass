import { NextResponse, connection } from "next/server";
import { getSql } from "@/lib/database/db";
import { handleError } from "@/lib/api";
import { EVAL_FIELDS, splitFor } from "@/lib/eval";

// GET /api/eval-summary — public "N of M" extraction accuracy on the TEST split, plus failures.
// 'na' (the page does not state it) is excluded from M. 'missing' counts as a failure.
export async function GET() {
  await connection();
  try {
    const rows = await getSql().query(
      `SELECT l.opportunity_id, l.field, l.verdict, l.note, o.title, o.source_url
         FROM eval_labels l JOIN opportunities o USING (opportunity_id)`,
    );
    const out = { dev: {} as Record<string, unknown>, test: {} as Record<string, unknown> };
    const failures: { split: string; field: string; verdict: string; title: string; source_url: string; note: string | null }[] = [];
    for (const split of ["dev", "test"] as const) {
      const mine = rows.filter((r) => splitFor(r.opportunity_id) === split);
      out[split] = {
        listings: new Set(mine.map((r) => r.opportunity_id)).size,
        fields: EVAL_FIELDS.map((f) => {
          const rs = mine.filter((r) => r.field === f.key && r.verdict !== "na");
          return { key: f.key, label: f.label, correct: rs.filter((r) => r.verdict === "correct").length, of: rs.length };
        }),
      };
      for (const r of mine) if (r.verdict === "wrong" || r.verdict === "missing")
        failures.push({ split, field: r.field, verdict: r.verdict, title: r.title, source_url: r.source_url, note: r.note });
    }
    return NextResponse.json({ ...out, failures });
  } catch (err) {
    return handleError("GET /api/eval-summary", err);
  }
}
