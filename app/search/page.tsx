"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, CATEGORY_LABELS, type Category, type OpportunityView } from "@/lib/client/types";
import { Logo, UserMenu } from "../components/nav-bar";
import OpportunityGrid from "../components/opportunity-grid";
import { useOpportunities } from "../components/use-opportunities";

type Sort = "relevance" | "deadline" | "newest";

// "Who can apply" filters. Each one reads a fact that was quoted from the source page; nothing is inferred.
const ACCESS_FILTERS = [
  { key: "intl", label: "Says international students can apply", test: (i: OpportunityView) => i.access?.international?.value === "open" },
  { key: "notcitizen", label: "Not U.S.-citizen-only", test: (i: OpportunityView) => i.access?.international?.value !== "restricted" },
  { key: "paid", label: "Paid or stipend", test: (i: OpportunityView) => ["paid", "stipend"].includes(i.access?.compensation?.value ?? "") },
  { key: "firstgen", label: "Made for first-gen students", test: (i: OpportunityView) => i.access?.first_gen?.value === "focus" },
  { key: "transfer", label: "Made for transfer students", test: (i: OpportunityView) => i.access?.transfer?.value === "focus" },
  { key: "nofee", label: "No fee mentioned", test: (i: OpportunityView) => i.access?.cost?.value !== "fee" },
] as const;

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const cats = (params.get("cat") ?? "").split(",").filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  const sortParam = params.get("sort") as Sort | null;
  const hideIneligible = params.get("hide") === "1";
  const who = (params.get("who") ?? "").split(",").filter((k) => ACCESS_FILTERS.some((f) => f.key === k));

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

  function toggleWho(k: string) {
    const set = new Set(who);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    update({ who: [...set].join(",") || null });
  }

  const active = ACCESS_FILTERS.filter((f) => who.includes(f.key));
  const shown = (items ?? []).filter(
    (i) => !(hideIneligible && i.match?.eligibility.status === "ineligible") && active.every((f) => f.test(i)),
  );
  const countFor = (f: (typeof ACCESS_FILTERS)[number]) =>
    (items ?? []).filter((i) => f.test(i) && ACCESS_FILTERS.filter((g) => g !== f && who.includes(g.key)).every((g) => g.test(i))).length;
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
              placeholder="Search labs, programs, events…"
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
          <div className="ac-who" role="group" aria-label="Who can apply">
            <span className="ac-who-label">Who can apply</span>
            <div className="ac-chips ac-chips-center">
              {ACCESS_FILTERS.map((f) => (
                <button key={f.key} type="button" className="ac-chip" aria-pressed={who.includes(f.key)} onClick={() => toggleWho(f.key)}>
                  {f.label}
                  {items ? <span className="ac-chip-n">{countFor(f)}</span> : null}
                </button>
              ))}
            </div>
            {who.includes("intl") ? (
              <p className="ac-note ac-who-note">
                Most listings never say whether international students can apply. This filter only keeps the ones that
                say so on their own page. Turn it off and use <strong>Not U.S.-citizen-only</strong> to also see listings that don&apos;t say,
                then ask the contact before you apply.
              </p>
            ) : null}
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
