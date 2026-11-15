"use client";

import type { OpportunityView } from "@/lib/client/types";
import { CATEGORY_LABELS } from "@/lib/client/types";
import { deadlineBadge, eligibilityBadge } from "@/lib/client/labels";

export function Star({ title = "Verified by a person against the source page" }: { title?: string }) {
  return (
    <svg className="ac-star" viewBox="0 0 20 20" width="14" height="14" role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.6L10 14.8l-5.1 2.6 1-5.6-4.1-4 5.7-.8z" fill="currentColor" />
    </svg>
  );
}

export function EligibilityPill({ item }: { item: OpportunityView }) {
  const b = eligibilityBadge(item, item.match);
  if (!b) return null;
  return (
    <span className={`ac-pill ac-tone-${b.tone}`}>
      {b.verified && b.tone === "green" ? <Star /> : null}
      <span className="ac-pill-label">{b.label}</span>
      {b.detail ? <span className="ac-pill-detail">{b.detail}</span> : null}
    </span>
  );
}

export function DeadlinePill({ item }: { item: OpportunityView }) {
  const d = deadlineBadge(item);
  if (!d) return null;
  return <span className={`ac-tag ac-tone-${d.tone}`}>{d.label}</span>;
}

export function RelevanceMeter({ score, lowConfidence }: { score: number | null | undefined; lowConfidence?: boolean }) {
  if (score === null || score === undefined) return null;
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div
      className={`ac-relevance ${lowConfidence ? "is-low" : ""}`}
      title={lowConfidence ? "Low confidence: few signals available" : "How closely this matches your interests and background — not your chance of getting in"}
    >
      <div className="ac-relevance-bar" aria-hidden="true">
        <span style={{ width: `${s}%` }} />
      </div>
      <span className="ac-relevance-num">{s}% match</span>
    </div>
  );
}

type Props = {
  item: OpportunityView;
  saved?: boolean;
  onOpen: (item: OpportunityView) => void;
  onToggleSave?: (item: OpportunityView) => void;
};

export default function OpportunityCard({ item, saved, onOpen, onToggleSave }: Props) {
  return (
    <article className="ac-card" data-category={item.category}>
      <button type="button" className="ac-card-hit" onClick={() => onOpen(item)} aria-label={`Open details: ${item.title}`} />
      <div className="ac-card-top">
        <span className="ac-tag ac-cat">{CATEGORY_LABELS[item.category]}</span>
        <DeadlinePill item={item} />
        {onToggleSave ? (
          <button
            type="button"
            className={`ac-save ${saved ? "is-saved" : ""}`}
            onClick={() => onToggleSave(item)}
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save"}
            title={saved ? "Saved" : "Save"}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M5 2.5h10a1 1 0 0 1 1 1v14l-6-3.6-6 3.6v-14a1 1 0 0 1 1-1z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        ) : null}
      </div>
      <h3 className="ac-card-title">{item.title}</h3>
      {item.organization ? <p className="ac-card-org">{item.organization}</p> : null}
      {item.description ? <p className="ac-card-desc">{item.description}</p> : null}
      <div className="ac-card-bottom">
        <EligibilityPill item={item} />
        <RelevanceMeter score={item.match?.relevance_score} lowConfidence={item.match?.low_confidence} />
      </div>
    </article>
  );
}
