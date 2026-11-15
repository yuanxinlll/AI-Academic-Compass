"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/client/types";
import { Logo, UserMenu } from "../components/nav-bar";
import OpportunityGrid from "../components/opportunity-grid";
import { useOpportunities } from "../components/use-opportunities";

type Sort = "relevance" | "deadline" | "newest";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const cats = (params.get("cat") ?? "").split(",").filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  const sortParam = params.get("sort") as Sort | null;
  const hideIneligible = params.get("hide") === "1";

  const sort: Sort = sortParam ?? "relevance";
  const { items, total, error, matchNote, personalized, loading } = useOpportunities({
    q: q || undefined,
    category: cats.length ? cats : undefined,
    sort,
  });

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    p.delete("open");
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  }

  function toggleCat(c: Category) {
    const set = new Set(cats);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    update({ cat: [...set].join(",") || null });
  }

  const shown = useMemo(
    () => (items ?? []).filter((i) => !(hideIneligible && i.match?.eligibility.status === "ineligible")),
    [items, hideIneligible],
  );
  const hiddenCount = (items?.length ?? 0) - shown.length;

  return (
    <>
      <header className="ac-search-top">
        <Logo />
        <UserMenu />
      </header>
      <main className="ac-page">
        <section className="ac-search-stage">
          <form
            className="ac-search ac-search-big"
            role="search"
            key={q}
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("q");
              update({ q: typeof value === "string" ? value.trim() || null : null });
            }}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="ac-search-icon">
              <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m13 13 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              className="ac-search-input"
              name="q"
              defaultValue={q}
              placeholder="Try “machine learning”, “summer”, “neuroscience lab”…"
              aria-label="Search opportunities"
              autoFocus
            />
            <button type="submit" className="ac-btn ac-btn-primary">
              Search
            </button>
          </form>
          <div className="ac-chips ac-chips-center">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className="ac-chip" aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </section>

        <div className="ac-toolbar">
          <p className="ac-muted" aria-live="polite">
            {loading ? "Searching…" : `${shown.length} of ${total} open opportunit${total === 1 ? "y" : "ies"}`}
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
          </p>
          <div className="ac-toolbar-right">
            {personalized ? (
              <label className="ac-switch">
                <input type="checkbox" checked={hideIneligible} onChange={(e) => update({ hide: e.target.checked ? "1" : null })} />
                <span>Hide not eligible</span>
              </label>
            ) : null}
            <label className="ac-select-wrap">
              <span className="ac-sr">Sort by</span>
              <select className="ac-select" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {personalized ? <option value="relevance">Best match</option> : <option value="relevance">Deadline</option>}
                <option value="deadline">Deadline soonest</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>
        </div>
        {matchNote ? <p className="ac-note">{matchNote}</p> : null}
        {error ? <p className="ac-error">{error}</p> : null}
        {loading ? (
          <div className="ac-skeleton-grid" aria-label="Loading" />
        ) : (
          <OpportunityGrid
            items={shown}
            empty={
              <div className="ac-empty">
                <p>No open opportunities match that search.</p>
                <button type="button" className="ac-btn" onClick={() => router.replace(pathname)}>
                  Clear filters
                </button>
              </div>
            }
          />
        )}
      </main>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
