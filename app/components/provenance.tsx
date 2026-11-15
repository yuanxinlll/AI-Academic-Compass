"use client";

import { useEffect, useState } from "react";
import { getHistory, type AuditEvent, type History } from "@/lib/client/api";
import { relativeTime } from "@/lib/client/labels";

const STATUS: Record<string, string> = { verified: "verified", needs_verification: "waiting for review", expired: "closed" };
const REASON: Record<string, string> = {
  closed: "says it is closed or full",
  deadline: "deadline looks wrong",
  requirements: "requirements look wrong",
  who_can_apply: "who-can-apply looks wrong",
  link: "link is broken",
  other: "something else",
};

function describe(e: AuditEvent): string {
  const d = e.detail ?? {};
  switch (e.action) {
    case "collected":
      return `Collector read the source page and saved this listing${d.model ? ` (${d.model})` : ""}.`;
    case "recollected":
      return d.kept_verified
        ? "Collector re-read the page. Nothing changed, so the reviewer's check still stands."
        : `Collector re-read the page${e.from_status && e.from_status !== e.to_status ? `; status went from ${STATUS[e.from_status] ?? e.from_status} to ${STATUS[e.to_status ?? ""] ?? e.to_status}` : ""}.`;
    case "status":
      return `Reviewer changed status${e.from_status ? ` from ${STATUS[e.from_status] ?? e.from_status}` : ""} to ${STATUS[e.to_status ?? ""] ?? e.to_status}.`;
    case "reported":
      return `A student reported a problem: ${REASON[String(d.reason)] ?? "other"}.`;
    case "report_resolved":
      return `Reviewer closed a student report (${REASON[String(d.reason)] ?? "other"}).`;
    case "lead_added":
      return `AI web search added an unverified lead about ${String(d.field ?? "a field").replace("_", " ")}${d.evidence_url ? ` from ${safeHost(String(d.evidence_url))}` : ""}.`;
    case "access_updated":
      return "Who-can-apply facts were read from the page (each needs an exact quote).";
    case "backfill":
      return String(d.note ?? "Recorded before the audit log existed.");
    default:
      return e.action;
  }
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname;
  } catch {
    return "another page";
  }
}

export function Provenance({ id }: { id: string }) {
  const [h, setH] = useState<History | null>(null);
  useEffect(() => {
    let alive = true;
    getHistory(id)
      .then((x) => alive && setH(x))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);
  if (!h) return null;
  const p = h.provenance;
  return (
    <details className="ac-detail-section ac-prov">
      <summary>
        <h3>Where this came from</h3>
        <span className="ac-muted ac-small">source, method and history</span>
      </summary>
      <dl className="ac-meta">
        <dt>Source page</dt>
        <dd>
          <a href={h.source_url} target="_blank" rel="noopener noreferrer">
            {safeHost(h.source_url)} ↗
          </a>
        </dd>
        <dt>Page read</dt>
        <dd>{p ? `${new Date(p.fetched_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} via Bright Data` : `${relativeTime(h.first_collected_at)} (details not recorded for older listings)`}</dd>
        {p ? (
          <>
            <dt>Page fingerprint</dt>
            <dd>
              <code title={p.page_sha256}>sha256 {p.page_sha256.slice(0, 12)}…</code>
              {p.page_chars ? <span className="ac-muted"> · {p.page_chars.toLocaleString()} characters</span> : null}
            </dd>
            <dt>Read by</dt>
            <dd>
              {p.model ?? "unknown model"}
              {p.prompt_sha ? <span className="ac-muted"> · prompt {p.prompt_sha}</span> : null}
              {p.collector_version ? <span className="ac-muted"> · {p.collector_version}</span> : null}
              {p.attempts && p.attempts > 1 ? <span className="ac-muted"> · needed a retry</span> : null}
            </dd>
            <dt>Quote check</dt>
            <dd>{p.quote_check === "passed" ? "Every quote shown was found word-for-word on the page." : "Not recorded"}</dd>
          </>
        ) : null}
        <dt>Decided by</dt>
        <dd>
          Fixed rules, not AI: eligibility <code>{h.rules.eligibility}</code>, fit score <code>{h.rules.relevance}</code>
        </dd>
      </dl>
      {h.events.length ? (
        <>
          <h4 className="ac-prov-h">History</h4>
          <ol className="ac-timeline">
            {h.events.map((e, i) => (
              <li key={i} className={`is-${e.actor}`}>
                <time dateTime={e.at}>{new Date(e.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
                <span>{describe(e)}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p className="ac-fineprint">The history is append-only: entries cannot be edited or deleted. Students who report problems are never named.</p>
    </details>
  );
}
