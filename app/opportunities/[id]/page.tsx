"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ApiError, getOpportunity, matchOpportunities } from "@/lib/client/api";
import type { OpportunityView } from "@/lib/client/types";
import NavBar from "../../components/nav-bar";
import { OpportunityDetail } from "../../components/opportunity-detail";
import { useSaved } from "../../components/use-opportunities";
import { useSession } from "../../components/session";

export default function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useSession();
  const saved = useSaved();
  const [item, setItem] = useState<OpportunityView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) return;
    let alive = true;
    (async () => {
      try {
        const o: OpportunityView = await getOpportunity(id);
        if (user?.has_profile) {
          const [m] = await matchOpportunities([id]).catch(() => []);
          if (m) o.match = m;
        }
        if (alive) setItem(o);
      } catch (e) {
        if (alive) setError(e instanceof ApiError && e.status === 404 ? "This opportunity no longer exists." : "Could not load this opportunity.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, user]);

  return (
    <>
      <NavBar />
      <main className="ac-page ac-narrow">
        <Link href="/search" className="ac-link">
          ← All opportunities
        </Link>
        <div className="ac-panel-card">
          {error ? <p className="ac-error">{error}</p> : null}
          {!item && !error ? <p className="ac-muted">Loading…</p> : null}
          {item ? (
            <OpportunityDetail
              item={item}
              signedIn={Boolean(user)}
              saved={saved.ids.has(item.opportunity_id)}
              onToggleSave={saved.enabled ? saved.toggle : undefined}
            />
          ) : null}
        </div>
      </main>
    </>
  );
}
