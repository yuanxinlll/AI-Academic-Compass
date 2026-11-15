"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getBookmarks,
  getOpportunities,
  loadDashboard,
  removeBookmark,
  saveBookmark,
  type OpportunityQuery,
} from "@/lib/client/api";
import type { OpportunityView } from "@/lib/client/types";
import { useSession } from "./session";

/**
 * Loads opportunities. Signed-in students with a profile also get eligibility + relevance
 * (via /api/match). Signed-out visitors get the plain public list — no labels.
 */
export function useOpportunities(query: OpportunityQuery) {
  const { user } = useSession();
  const [items, setItems] = useState<OpportunityView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [matchNote, setMatchNote] = useState<string | null>(null);
  const key = JSON.stringify(query);
  const personalized = Boolean(user && user.has_profile);

  useEffect(() => {
    if (user === undefined) return;
    let alive = true;
    const q = JSON.parse(key) as OpportunityQuery;
    (async () => {
      try {
        if (personalized) {
          const r = await loadDashboard(q);
          if (!alive) return;
          setItems(r.items);
          setTotal(r.total);
          setError(null);
          setMatchNote(
            r.matchError
              ? r.matchError.code === "PROFILE_NOT_FOUND"
                ? "Finish your profile to see eligibility."
                : "Personal matching is unavailable right now. Showing all listings."
              : null,
          );
        } else {
          const r = await getOpportunities({ ...q, sort: q.sort === "relevance" ? "deadline" : q.sort, limit: q.limit ?? 100 });
          if (!alive) return;
          setItems(r.items);
          setTotal(r.total);
          setError(null);
          setMatchNote(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : "Could not load opportunities.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, personalized, user]);

  return { items, total, error, matchNote, personalized, loading: items === null && !error };
}

/** The signed-in user's saved opportunity ids, with optimistic toggle. */
export function useSaved() {
  const { user } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    getBookmarks()
      .then((b) => setIds(new Set(b.map((x) => x.opportunity.opportunity_id))))
      .catch(() => undefined);
  }, [user]);

  const toggle = useCallback(
    async (item: OpportunityView) => {
      const id = item.opportunity_id;
      const wasSaved = ids.has(id);
      setIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        if (wasSaved) await removeBookmark(id);
        else await saveBookmark(id);
      } catch {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [ids],
  );

  return useMemo(() => ({ ids: user ? ids : new Set<string>(), toggle, enabled: Boolean(user) }), [ids, toggle, user]);
}
