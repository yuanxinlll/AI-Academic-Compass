"use client";

import { CATEGORY_LABELS, type Opportunity } from "@/lib/client/types";

export function matchesQuery(o: Opportunity, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [o.title, o.organization, o.source_url, CATEGORY_LABELS[o.category], o.status, ...o.eligibility.map((r) => r.raw_text)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function AdminSearch({ value, onChange, count }: { value: string; onChange: (v: string) => void; count?: string }) {
  return (
    <div className="ac-admin-search">
      <label className="ac-search">
        <svg className="ac-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="ac-search-input"
          type="search"
          placeholder="Search title, lab, URL or quote"
          aria-label="Search listings"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {count ? <span className="ac-muted ac-small">{count}</span> : null}
    </div>
  );
}
