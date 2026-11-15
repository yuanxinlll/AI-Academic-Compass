"use client";

import { useEffect, useState } from "react";
import { ApiError, getReviewQueue, resolveReport, setOpportunityStatus, type StudentReport } from "@/lib/client/api";
import { CATEGORY_LABELS, type Opportunity, type OpportunityStatus } from "@/lib/client/types";
import { REQUIREMENT_LABELS, deadlineBadge, relativeTime } from "@/lib/client/labels";
import NavBar from "../components/nav-bar";
import { AdminSearch, matchesQuery } from "./admin-search";
import { RequireSignIn } from "../components/session";

const REPORT_TEXT: Record<string, string> = {
  closed: "Says it's closed or full",
  deadline: "Deadline wrong",
  requirements: "Requirements wrong or missing",
  who_can_apply: "Who can apply wrong",
  link: "Broken link",
  other: "Other",
};

function ReviewInner() {
  const [items, setItems] = useState<Opportunity[] | null>(null);
  const [reviewed, setReviewed] = useState<Opportunity[]>([]);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [counts, setCounts] = useState<Partial<Record<OpportunityStatus, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, OpportunityStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const shown = (list: Opportunity[]) => list.filter((o) => matchesQuery(o, q));

  useEffect(() => {
    getReviewQueue()
      .then((r) => {
        setItems(r.items);
        setReviewed(r.reviewed);
        setReports(r.reports ?? []);
        setCounts(r.counts);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the queue."));
  }, []);

  async function decide(o: Opportunity, status: OpportunityStatus) {
    setBusy(o.opportunity_id);
    try {
      await setOpportunityStatus(o.opportunity_id, status);
      setDone((d) => ({ ...d, [o.opportunity_id]: status }));
      setCounts((c) => ({
        ...c,
        needs_verification: Math.max(0, (c.needs_verification ?? 1) - 1),
        [status]: (c[status] ?? 0) + 1,
      }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save that decision.");
    } finally {
      setBusy(null);
    }
  }

  async function undo(o: Opportunity) {
    const prev = done[o.opportunity_id];
    setBusy(o.opportunity_id);
    try {
      await setOpportunityStatus(o.opportunity_id, "needs_verification");
      setDone((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== o.opportunity_id)));
      setCounts((c) => ({ ...c, needs_verification: (c.needs_verification ?? 0) + 1, [prev]: Math.max(0, (c[prev] ?? 1) - 1) }));
    } finally {
      setBusy(null);
    }
  }

  async function returnToQueue(o: Opportunity) {
    setBusy(o.opportunity_id);
    try {
      await setOpportunityStatus(o.opportunity_id, "needs_verification");
      setReviewed((list) => list.filter((x) => x.opportunity_id !== o.opportunity_id));
      setItems((list) => [{ ...o, status: "needs_verification" }, ...(list ?? [])]);
      setCounts((c) => ({ ...c, needs_verification: (c.needs_verification ?? 0) + 1, [o.status]: Math.max(0, (c[o.status] ?? 1) - 1) }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not move it back.");
    } finally {
      setBusy(null);
    }
  }

  async function resolve(r: StudentReport, reopen: boolean) {
    setBusy(r.report_id);
    try {
      if (reopen && r.status !== "needs_verification") {
        await setOpportunityStatus(r.opportunity_id, "needs_verification");
        const moved = reviewed.find((o) => o.opportunity_id === r.opportunity_id);
        setReviewed((list) => list.filter((o) => o.opportunity_id !== r.opportunity_id));
        if (moved) setItems((list) => [{ ...moved, status: "needs_verification" }, ...(list ?? [])]);
      }
      await resolveReport(r.report_id);
      setReports((list) => list.filter((x) => x.report_id !== r.report_id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update that report.");
    } finally {
      setBusy(null);
    }
  }

  const shownReports = reports.filter(
    (r) => !q || q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => `${r.title} ${r.organization ?? ""} ${r.source_url} ${r.note ?? ""}`.toLowerCase().includes(w)),
  );

  return (
    <>
      <NavBar />
      <main className="ac-page">
        <section className="ac-section">
          <div className="ac-section-head">
            <div>
              <p className="ac-eyebrow">Reviewer</p>
              <h1 className="ac-h1">Review queue</h1>
            </div>
            <dl className="ac-stats ac-stats-sm">
              <div>
                <dt>Waiting</dt>
                <dd>{counts.needs_verification ?? 0}</dd>
              </div>
              <div>
                <dt>Verified</dt>
                <dd>{counts.verified ?? 0}</dd>
              </div>
              <div>
                <dt>Expired</dt>
                <dd>{counts.expired ?? 0}</dd>
              </div>
            </dl>
          </div>
          <p className="ac-muted">
            Open the source page and compare it with the quotes below. Verify only if every quote is on the page and
            nothing important is missing. If a field was extracted wrong, leave it here and tell the collection team.
          </p>
          <AdminSearch
            value={q}
            onChange={setQ}
            count={q && items ? `${shown(items).length} waiting · ${shown(reviewed).length} reviewed match` : undefined}
          />
          {error ? <p className="ac-error">{error}</p> : null}
          {items === null && !error ? <p className="ac-muted">Loading…</p> : null}
          {items?.length === 0 ? <p className="ac-empty">Nothing waiting. Nice.</p> : null}
          {items && items.length > 0 && q && shown(items).length === 0 ? (
            <p className="ac-empty">No waiting listing matches “{q}”.</p>
          ) : null}
          <ul className="ac-review-list">
            {(items ? shown(items) : []).map((o) => {
              const decided = done[o.opportunity_id];
              const d = deadlineBadge(o);
              return (
                <li key={o.opportunity_id} className={`ac-review ${decided ? "is-done" : ""}`}>
                  <div className="ac-review-main">
                    <div className="ac-card-top">
                      <span className="ac-tag ac-cat">{CATEGORY_LABELS[o.category]}</span>
                      {d ? <span className={`ac-tag ac-tone-${d.tone}`}>{d.label}</span> : null}
                      <span className="ac-muted ac-small">collected {relativeTime(o.first_collected_at)}</span>
                    </div>
                    <h3 className="ac-card-title">{o.title}</h3>
                    {o.organization ? <p className="ac-card-org">{o.organization}</p> : null}
                    <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="ac-link ac-small">
                      {o.source_url} ↗
                    </a>
                    {o.eligibility.length ? (
                      <ul className="ac-reqs ac-reqs-compact">
                        {o.eligibility.map((r, i) => (
                          <li key={i} className="ac-req">
                            <div className="ac-req-head">
                              <span className="ac-req-type">{REQUIREMENT_LABELS[r.type] ?? r.type}</span>
                              <span className="ac-req-kind">{r.is_hard_requirement ? "Required" : "Preferred"}</span>
                            </div>
                            <blockquote className="ac-quote">“{r.raw_text}”</blockquote>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ac-note">No requirements were extracted. Check the page for any that were missed.</p>
                    )}
                  </div>
                  <div className="ac-review-actions">
                    {decided ? (
                      <>
                        <span className={`ac-tag ${decided === "verified" ? "ac-tone-green" : "ac-tone-muted"}`}>
                          {decided === "verified" ? "Verified" : "Marked expired"}
                        </span>
                        <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={() => undo(o)} disabled={busy === o.opportunity_id}>
                          Undo
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="ac-btn ac-btn-primary" onClick={() => decide(o, "verified")} disabled={busy === o.opportunity_id}>
                          Verify
                        </button>
                        <button type="button" className="ac-btn" onClick={() => decide(o, "expired")} disabled={busy === o.opportunity_id}>
                          Mark expired
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {shownReports.length ? (
          <section className="ac-section">
            <div className="ac-section-head">
              <h2>Student reports</h2>
              <span className="ac-muted ac-small">{shownReports.length} open</span>
            </div>
            <ul className="ac-saved">
              {shownReports.map((r) => (
                <li key={r.report_id}>
                  <div className="ac-saved-main">
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="ac-saved-title">
                      {r.title}
                    </a>
                    <span className="ac-muted">
                      {REPORT_TEXT[r.reason] ?? r.reason} · {relativeTime(r.created_at)}
                      {r.note ? ` · “${r.note}”` : ""}
                    </span>
                  </div>
                  {r.status !== "needs_verification" ? (
                    <button type="button" className="ac-btn ac-btn-sm" onClick={() => resolve(r, true)} disabled={busy === r.report_id}>
                      Return to queue
                    </button>
                  ) : null}
                  <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={() => resolve(r, false)} disabled={busy === r.report_id}>
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {shown(reviewed).length ? (
          <section className="ac-section">
            <div className="ac-section-head">
              <h2>Reviewed</h2>
            </div>
            <ul className="ac-saved">
              {shown(reviewed).map((o) => (
                <li key={o.opportunity_id}>
                  <div className="ac-saved-main">
                    <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="ac-saved-title">
                      {o.title}
                    </a>
                    <span className="ac-muted">
                      {CATEGORY_LABELS[o.category]}
                      {o.status === "verified" ? ` · verified ${relativeTime(o.last_verified_at)}` : ""}
                    </span>
                  </div>
                  <span className={`ac-tag ${o.status === "verified" ? "ac-tone-green" : "ac-tone-muted"}`}>
                    {o.status === "verified" ? "Verified" : "Expired"}
                  </span>
                  <button
                    type="button"
                    className="ac-btn ac-btn-ghost ac-btn-sm"
                    onClick={() => returnToQueue(o)}
                    disabled={busy === o.opportunity_id}
                  >
                    Return to queue
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

export default function AdminPage() {
  return (
    <RequireSignIn admin>
      <ReviewInner />
    </RequireSignIn>
  );
}
