import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import {
  SOURCE_TYPES, ValidationError, httpUrl, isObject, optEnum, optString, parseOpportunityInput,
} from "@/lib/validation";

const MAX_BATCH = 50;


// POST /api/admin/opportunities — batch upsert for A's collector (contracts §4.5).
// Dedup key: source_url. Each item is validated on its own; bad items are reported, good ones saved.
export async function POST(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const body = await readJson(req);
    if (!isObject(body)) throw new ValidationError("body", "Request body must be a JSON object");
    const items = body.opportunities;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BATCH)
      throw new ValidationError("opportunities", `opportunities must be an array of 1–${MAX_BATCH} items`);

    const sql = getSql();

    // Optional: which source page these came from → upsert into sources + write a collection log.
    let sourceId: string | null = null;
    if (body.source !== undefined && body.source !== null) {
      if (!isObject(body.source)) throw new ValidationError("source", "source must be an object");
      const websiteUrl = httpUrl(body.source.website_url, "source.website_url");
      const sourceType = optEnum(body.source, "source_type", SOURCE_TYPES) ?? "other";
      const university = optString(body.source, "university", 100) ?? "UCSD";
      const rows = await sql.query(
        `INSERT INTO sources (university, website_url, source_type, last_checked_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (website_url) DO UPDATE
           SET last_checked_at = now(), source_type = EXCLUDED.source_type
         RETURNING source_id`,
        [university, websiteUrl, sourceType],
      );
      sourceId = rows[0].source_id as string;
    }

    let inserted = 0;
    let updated = 0;
    let needsVerification = 0;
    const errors: { index: number; source_url: unknown; field: string; message: string }[] = [];
    const saved: { index: number; opportunity_id: string; action: "inserted" | "updated" }[] = [];

    for (const [index, raw] of items.entries()) {
      let o;
      try {
        o = parseOpportunityInput(raw);
      } catch (e) {
        if (!(e instanceof ValidationError)) throw e;
        errors.push({ index, source_url: isObject(raw) ? raw.source_url ?? null : null, field: e.field, message: e.message });
        continue;
      }

      // Re-collecting a page refreshes last_verified_at and keeps first_collected_at.
      // A human-set 'verified' status survives a re-crawl only if the content did not change.
      const rows = await sql.query(
        `INSERT INTO opportunities AS cur (
           title, university, organization, category, description, required_skills, eligibility,
           deadline, deadline_text, application_method, source_url, source_id, status,
           access, source_kind, first_collected_at, last_verified_at
         ) VALUES ($1,$2,$3,$4,$5,$6::text[],$7::jsonb,$8::date,$9,$10,$11,$12,$13,
                   COALESCE($14::jsonb, '{}'::jsonb), $15, now(), now())
         ON CONFLICT (source_url) DO UPDATE SET
           title = EXCLUDED.title, university = EXCLUDED.university, organization = EXCLUDED.organization,
           category = EXCLUDED.category, description = EXCLUDED.description,
           required_skills = EXCLUDED.required_skills, eligibility = EXCLUDED.eligibility,
           deadline = EXCLUDED.deadline, deadline_text = EXCLUDED.deadline_text,
           application_method = EXCLUDED.application_method,
           source_id = COALESCE(EXCLUDED.source_id, cur.source_id),
           access = CASE WHEN $14::jsonb IS NULL THEN cur.access ELSE EXCLUDED.access END,
           source_kind = EXCLUDED.source_kind,
           last_verified_at = now(),
           status = CASE
             WHEN cur.status = 'verified' AND EXCLUDED.status = 'needs_verification'
              AND (cur.title, cur.organization, cur.category, cur.description, cur.required_skills,
                   cur.eligibility, cur.deadline, cur.deadline_text, cur.application_method)
                  IS NOT DISTINCT FROM
                  (EXCLUDED.title, EXCLUDED.organization, EXCLUDED.category, EXCLUDED.description,
                   EXCLUDED.required_skills, EXCLUDED.eligibility, EXCLUDED.deadline,
                   EXCLUDED.deadline_text, EXCLUDED.application_method)
             THEN 'verified'
             ELSE EXCLUDED.status
           END
         RETURNING opportunity_id, status, (xmax = 0) AS inserted`,
        [
          o.title, o.university, o.organization, o.category, o.description, o.required_skills,
          JSON.stringify(o.eligibility), o.deadline, o.deadline_text, o.application_method,
          o.source_url, sourceId, o.status,
          o.access ? JSON.stringify(o.access) : null, o.source_kind,
        ],
      );
      const r = rows[0] as { opportunity_id: string; status: string; inserted: boolean };
      if (r.inserted) inserted++;
      else updated++;
      if (r.status === "needs_verification") needsVerification++;
      saved.push({ index, opportunity_id: r.opportunity_id, action: r.inserted ? "inserted" : "updated" });
    }

    const summary = {
      records_found: items.length,
      inserted,
      updated,
      duplicates: updated, // same source_url seen before
      needs_verification: needsVerification,
      rejected: errors.length,
      errors,
      saved,
    };

    if (sourceId) {
      await sql.query(
        `INSERT INTO collection_logs (source_id, records_found, errors) VALUES ($1, $2, $3::jsonb)`,
        [sourceId, items.length, JSON.stringify(errors)],
      );
    }

    return NextResponse.json(summary, { status: errors.length && !saved.length ? 422 : 200 });
  } catch (err) {
    return handleError("POST /api/admin/opportunities", err);
  }
}
