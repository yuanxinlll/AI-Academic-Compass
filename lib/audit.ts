import type { NextRequest } from "next/server";
import { getSql } from "@/lib/database/db";
import { readSession } from "@/lib/session";

export type AuditAction =
  | "collected" | "recollected" | "status" | "reported" | "report_resolved" | "lead_added" | "access_updated";

/** Who is acting: a signed-in reviewer, the collector (admin token), or a student. */
export function actorOf(req: NextRequest): { role: "reviewer" | "collector" | "student"; name: string | null } {
  const s = readSession(req);
  if (s?.role === "admin") return { role: "reviewer", name: s.username };
  if (s) return { role: "student", name: s.username };
  return { role: "collector", name: null };
}

/**
 * Appends one audit row. Never throws: a logging failure must not undo the action itself,
 * but it is reported to the server log so it can be noticed.
 */
export async function audit(
  req: NextRequest,
  opportunityId: string,
  action: AuditAction,
  extra: { from?: string | null; to?: string | null; detail?: Record<string, unknown> } = {},
) {
  const who = actorOf(req);
  try {
    await getSql().query(
      `INSERT INTO opportunity_audit (opportunity_id, actor_role, actor, action, from_status, to_status, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [opportunityId, who.role, who.name, action, extra.from ?? null, extra.to ?? null, extra.detail ? JSON.stringify(extra.detail) : null],
    );
  } catch (err) {
    console.error(JSON.stringify({ event: "audit_write_failed", action, opportunityId, error: err instanceof Error ? err.name : "unknown" }));
  }
}
