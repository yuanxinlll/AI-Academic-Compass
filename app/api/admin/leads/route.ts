import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { requireAdmin } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { handleError, readJson } from "@/lib/api";
import { UUID_RE, ValidationError, httpUrl, isObject, optString } from "@/lib/validation";

const FIELDS = ["deadline", "eligibility", "application_method", "compensation", "international", "other"] as const;

// POST /api/admin/leads — { opportunity_id, leads: [{ field, value, quote, evidence_url, found_by? }] }
// Facts an AI web search found outside the listing's own page. Stored as unverified leads;
// they are shown with their source and never feed eligibility.
export async function POST(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const body = await readJson(req);
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const id = body.opportunity_id;
    if (typeof id !== "string" || !UUID_RE.test(id)) throw new ValidationError("opportunity_id", "opportunity_id must be a UUID");
    if (!Array.isArray(body.leads) || body.leads.length > 20) throw new ValidationError("leads", "leads must be an array (max 20)");
    const leads = body.leads.map((l, i) => {
      if (!isObject(l)) throw new ValidationError(`leads[${i}]`, "each lead must be an object");
      const field = typeof l.field === "string" && (FIELDS as readonly string[]).includes(l.field) ? l.field : null;
      if (!field) throw new ValidationError(`leads[${i}].field`, `field must be one of: ${FIELDS.join(", ")}`);
      const value = optString(l, "value", 500);
      const quote = optString(l, "quote", 1000);
      if (!value || !quote) throw new ValidationError(`leads[${i}]`, "value and quote are required");
      return { field, value, quote, evidence_url: httpUrl(l.evidence_url, `leads[${i}].evidence_url`), found_by: optString(l, "found_by", 50) ?? "gemini_search" };
    });
    const sql = getSql();
    let saved = 0;
    for (const l of leads) {
      const r = await sql.query(
        `INSERT INTO opportunity_leads (opportunity_id, field, value, quote, evidence_url, found_by)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING lead_id`,
        [id, l.field, l.value, l.quote, l.evidence_url, l.found_by],
      );
      saved += r.length;
      if (r.length) await audit(req, id, "lead_added", { detail: { field: l.field, evidence_url: l.evidence_url, found_by: l.found_by } });
    }
    return NextResponse.json({ saved, skipped: leads.length - saved });
  } catch (err) {
    return handleError("POST /api/admin/leads", err);
  }
}
