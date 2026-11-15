import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { requireAdmin } from "@/lib/admin";
import { handleError, readJson } from "@/lib/api";
import { EVAL_FIELDS, splitFor } from "@/lib/eval";
import { UUID_RE, ValidationError, isObject, optString } from "@/lib/validation";

// GET  /api/admin/eval — listings with their split and existing labels.
// POST /api/admin/eval — { opportunity_id, field, verdict, note? } (one label; re-posting overwrites).
export async function GET(req: NextRequest) {
  await connection();
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const sql = getSql();
    const [items, labels] = await Promise.all([
      sql.query(`SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o ORDER BY o.first_collected_at DESC LIMIT 200`),
      sql.query(`SELECT opportunity_id, field, verdict, note FROM eval_labels`),
    ]);
    const byId: Record<string, Record<string, { verdict: string; note: string | null }>> = {};
    for (const l of labels) (byId[l.opportunity_id] ??= {})[l.field] = { verdict: l.verdict, note: l.note };
    return NextResponse.json({
      fields: EVAL_FIELDS,
      items: items.map((o) => ({ ...o, split: splitFor(o.opportunity_id), labels: byId[o.opportunity_id] ?? {} })),
    });
  } catch (err) {
    return handleError("GET /api/admin/eval", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const b = await readJson(req);
    if (!isObject(b)) throw new ValidationError("body", "Request body must be a JSON object");
    const id = b.opportunity_id;
    if (typeof id !== "string" || !UUID_RE.test(id)) throw new ValidationError("opportunity_id", "must be a UUID");
    const field = EVAL_FIELDS.find((f) => f.key === b.field);
    if (!field) throw new ValidationError("field", "unknown field");
    if (typeof b.verdict !== "string" || !(field.verdicts as readonly string[]).includes(b.verdict))
      throw new ValidationError("verdict", `verdict must be one of: ${field.verdicts.join(", ")}`);
    await getSql().query(
      `INSERT INTO eval_labels (opportunity_id, field, verdict, note) VALUES ($1,$2,$3,$4)
       ON CONFLICT (opportunity_id, field) DO UPDATE SET verdict = EXCLUDED.verdict, note = EXCLUDED.note, labeled_at = now()`,
      [id, field.key, b.verdict, optString(b, "note", 500)],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError("POST /api/admin/eval", err);
  }
}
