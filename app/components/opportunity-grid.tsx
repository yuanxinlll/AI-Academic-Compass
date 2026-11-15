"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpportunityView } from "@/lib/client/types";
import OpportunityCard from "./opportunity-card";
import { DetailPanel, OpportunityDetail } from "./opportunity-detail";
import { useSaved } from "./use-opportunities";
import { useSession } from "./session";

/** Card grid + the slide-over detail panel. The open card is mirrored in ?open=<id>. */
export default function OpportunityGrid({ items, empty }: { items: OpportunityView[]; empty?: React.ReactNode }) {
  const { user } = useSession();
  const saved = useSaved();
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    // Deep link (?open=<id>) can only be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setOpenId(id);
  }, []);

  const setUrl = useCallback((id: string | null) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("open", id);
    else u.searchParams.delete("open");
    window.history.replaceState(null, "", u);
  }, []);

  const open = items.find((i) => i.opportunity_id === openId) ?? null;

  if (!items.length) return <>{empty ?? <p className="ac-muted">Nothing here yet.</p>}</>;

  return (
    <>
      <div className="ac-grid">
        {items.map((item) => (
          <OpportunityCard
            key={item.opportunity_id}
            item={item}
            saved={saved.ids.has(item.opportunity_id)}
            onOpen={(i) => {
              setOpenId(i.opportunity_id);
              setUrl(i.opportunity_id);
            }}
            onToggleSave={saved.enabled ? saved.toggle : undefined}
          />
        ))}
      </div>
      {open ? (
        <DetailPanel
          onClose={() => {
            setOpenId(null);
            setUrl(null);
          }}
        >
          <OpportunityDetail
            item={open}
            signedIn={Boolean(user)}
            saved={saved.ids.has(open.opportunity_id)}
            onToggleSave={saved.enabled ? saved.toggle : undefined}
          />
          <p className="ac-fineprint">
            <a href={`/opportunities/${open.opportunity_id}`}>Permanent link to this opportunity</a>
          </p>
        </DetailPanel>
      ) : null}
    </>
  );
}
