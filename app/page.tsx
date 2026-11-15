"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getStats, sortByRelevance, type Stats } from "@/lib/client/api";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/client/types";
import { relativeTime } from "@/lib/client/labels";
import NavBar from "./components/nav-bar";
import OpportunityGrid from "./components/opportunity-grid";
import { useOpportunities } from "./components/use-opportunities";
import { useSession } from "./components/session";

export default function HomePage() {
  const { user } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const { items, error, matchNote, personalized, loading } = useOpportunities({ sort: "deadline" });

  useEffect(() => {
    getStats().then(setStats).catch(() => undefined);
  }, []);

  const picks = useMemo(() => {
    if (!items) return [];
    if (!personalized) return items.slice(0, 6);
    return sortByRelevance(items.filter((i) => i.match?.eligibility.status !== "ineligible")).slice(0, 6);
  }, [items, personalized]);

  return (
    <>
      <NavBar />
      <main className="ac-page">
        <section className="ac-hero">
          <p className="ac-eyebrow">UC San Diego · SanD Hacks 2026</p>
          <h1>
            Discover opportunities.
            <br />
            Navigate your future.
          </h1>
          <p className="ac-lede">
            Research, internships, programs and events from across campus, in one place. Every requirement is quoted
            from its source, so you know exactly what to confirm.
          </p>
          <form
            className="ac-search ac-search-hero"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
            }}
          >
            <input
              className="ac-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search labs, internships, programs…"
              aria-label="Search opportunities"
            />
            <button type="submit" className="ac-btn ac-btn-primary">
              Search
            </button>
          </form>
          <div className="ac-chips">
            {CATEGORIES.map((c) => (
              <Link key={c} href={`/search?cat=${c}`} className="ac-chip">
                {CATEGORY_LABELS[c]}
                {stats?.by_category[c] ? <span className="ac-chip-n">{stats.by_category[c]}</span> : null}
              </Link>
            ))}
          </div>
          {stats ? (
            <dl className="ac-stats">
              <div>
                <dt>Open now</dt>
                <dd>{stats.open_total}</dd>
              </div>
              <div>
                <dt>Checked by a person</dt>
                <dd>{stats.verified_total}</dd>
              </div>
              <div>
                <dt>Closing in 2 weeks</dt>
                <dd>{stats.closing_soon}</dd>
              </div>
              <div>
                <dt>Sources watched</dt>
                <dd>{stats.sources_total}</dd>
              </div>
            </dl>
          ) : null}
          {stats?.last_collected_at ? (
            <p className="ac-fineprint">Last new listing collected {relativeTime(stats.last_collected_at)}.</p>
          ) : null}
        </section>

        <section className="ac-section">
          <div className="ac-section-head">
            <h2>{personalized ? `Picked for you, ${user?.display_name.split(" ")[0]}` : "Open now"}</h2>
            <Link href="/search" className="ac-link">
              See all →
            </Link>
          </div>
          {!user && user !== undefined ? (
            <div className="ac-banner">
              <span>Sign in to see which ones you qualify for and how well each one fits you.</span>
              <Link href="/login" className="ac-btn ac-btn-primary ac-btn-sm">
                Sign in
              </Link>
            </div>
          ) : null}
          {user && !user.has_profile && user.role === "student" ? (
            <div className="ac-banner">
              <span>Add your background to get personal results.</span>
              <Link href="/onboarding" className="ac-btn ac-btn-primary ac-btn-sm">
                Build profile
              </Link>
            </div>
          ) : null}
          {matchNote ? <p className="ac-note">{matchNote}</p> : null}
          {error ? <p className="ac-error">{error}</p> : null}
          {loading ? <div className="ac-skeleton-grid" aria-label="Loading" /> : <OpportunityGrid items={picks} />}
        </section>
      </main>
    </>
  );
}
