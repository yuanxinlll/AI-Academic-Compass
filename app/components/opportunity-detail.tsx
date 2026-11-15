"use client";

import { useEffect } from "react";
import type { EligibilityCheck, EligibilityRequirement, OpportunityView } from "@/lib/client/types";
import { CATEGORY_LABELS } from "@/lib/client/types";
import { REQUIREMENT_LABELS, eligibilityBadge, formatDate, relativeTime } from "@/lib/client/labels";
import { DeadlinePill, EligibilityPill, RelevanceMeter, Star } from "./opportunity-card";

const CHECK_TEXT: Record<EligibilityCheck["result"], string> = {
  eligible: "You meet this",
  ineligible: "You don't meet this",
  needs_confirmation: "Confirm this",
};

function pairChecks(reqs: EligibilityRequirement[], checks: EligibilityCheck[] | undefined) {
  const pool = [...(checks ?? [])];
  return reqs.map((r) => {
    let i = pool.findIndex((c) => c.type === r.type && c.raw_text && c.raw_text === r.raw_text);
    if (i < 0) i = pool.findIndex((c) => c.type === r.type);
    return { req: r, check: i >= 0 ? pool.splice(i, 1)[0] : undefined };
  });
}

type Props = {
  item: OpportunityView;
  signedIn: boolean;
  saved?: boolean;
  onToggleSave?: (item: OpportunityView) => void;
};

export function OpportunityDetail({ item, signedIn, saved, onToggleSave }: Props) {
  const badge = eligibilityBadge(item, item.match);
  const rows = pairChecks(item.eligibility ?? [], item.match?.eligibility.checks);
  const verified = item.status === "verified";

  return (
    <div className="ac-detail">
      <div className="ac-card-top">
        <span className="ac-tag ac-cat">{CATEGORY_LABELS[item.category]}</span>
        <DeadlinePill item={item} />
      </div>
      <h2 className="ac-detail-title">{item.title}</h2>
      {item.organization ? <p className="ac-card-org">{item.organization}</p> : null}

      <div className="ac-detail-status">
        {signedIn ? <EligibilityPill item={item} /> : null}
        <RelevanceMeter score={item.match?.relevance_score} />
      </div>
      <p className="ac-fineprint">
        {verified ? (
          <>
            <Star /> A person checked this listing against its source {relativeTime(item.last_verified_at)}.
          </>
        ) : (
          <>Collected from the source page {relativeTime(item.first_collected_at)}. Nobody has checked it by hand yet.</>
        )}
      </p>

      <div className="ac-detail-actions">
        <a className="ac-btn ac-btn-primary" href={item.source_url} target="_blank" rel="noopener noreferrer">
          Open source page ↗
        </a>
        {onToggleSave ? (
          <button type="button" className="ac-btn" onClick={() => onToggleSave(item)} aria-pressed={saved}>
            {saved ? "Saved ✓" : "Save"}
          </button>
        ) : null}
      </div>

      {item.description ? (
        <section className="ac-detail-section">
          <h3>About</h3>
          <p>{item.description}</p>
        </section>
      ) : null}

      <section className="ac-detail-section">
        <h3>Requirements</h3>
        {rows.length === 0 ? (
          <p className="ac-muted">
            {verified ? "The source page lists no specific requirements." : "No requirements were found on the source page. Check it before applying."}
          </p>
        ) : (
          <ul className="ac-reqs">
            {rows.map(({ req, check }, i) => (
              <li key={i} className="ac-req">
                <div className="ac-req-head">
                  <span className="ac-req-type">{REQUIREMENT_LABELS[req.type] ?? req.type}</span>
                  <span className="ac-req-kind">{req.is_hard_requirement ? "Required" : "Preferred"}</span>
                  {signedIn && check ? (
                    <span className={`ac-tag ac-check-${check.result}`}>{CHECK_TEXT[check.result]}</span>
                  ) : null}
                </div>
                <blockquote className="ac-quote">“{req.raw_text}”</blockquote>
                {signedIn && check?.reason ? <p className="ac-req-reason">{check.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {signedIn && badge ? (
          <p className="ac-fineprint">Eligibility is worked out by fixed rules from these quotes and your profile. AI does not decide it.</p>
        ) : null}
      </section>

      {signedIn && item.match?.explanation ? (
        <section className="ac-detail-section ac-ai">
          <h3>
            Why it might fit you <span className="ac-ai-tag">AI summary</span>
          </h3>
          <p>{item.match.explanation}</p>
          {item.match.reasons?.length ? (
            <ul className="ac-bullets">
              {item.match.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
          {item.match.questions_to_confirm?.length ? (
            <>
              <h4>Worth asking before you apply</h4>
              <ul className="ac-bullets">
                {item.match.questions_to_confirm.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="ac-fineprint">Written by AI from the listing and your profile. It can be wrong. Always check the source page.</p>
        </section>
      ) : null}

      <dl className="ac-meta">
        {item.deadline || item.deadline_text ? (
          <>
            <dt>Deadline</dt>
            <dd>{item.deadline ? formatDate(item.deadline) : item.deadline_text}</dd>
          </>
        ) : null}
        {item.application_method ? (
          <>
            <dt>How to apply</dt>
            <dd>{item.application_method}</dd>
          </>
        ) : null}
        {item.required_skills?.length ? (
          <>
            <dt>Skills mentioned</dt>
            <dd>{item.required_skills.join(", ")}</dd>
          </>
        ) : null}
        <dt>Source</dt>
        <dd>
          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
            {new URL(item.source_url).hostname}
          </a>
        </dd>
      </dl>
      {!signedIn ? (
        <p className="ac-signin-hint">
          <a href="/login">Sign in</a> to see whether you meet each requirement.
        </p>
      ) : null}
    </div>
  );
}

/** Right-side slide-over. Esc or the backdrop closes it. */
export function DetailPanel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="ac-panel-root">
      <div className="ac-panel-backdrop" onClick={onClose} />
      <aside className="ac-panel" role="dialog" aria-modal="true" aria-label="Opportunity details">
        <button type="button" className="ac-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </aside>
    </div>
  );
}
