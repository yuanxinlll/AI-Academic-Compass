import { Suspense } from "react";
import OpportunityView from "./opportunity-view";

export default function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="ac-center"><p className="ac-muted">Loading…</p></main>}>
      <OpportunityView params={params} />
    </Suspense>
  );
}
