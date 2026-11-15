"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptDisclaimer } from "@/lib/client/api";
import { Logo } from "../components/nav-bar";
import { useSession } from "../components/session";

const POINTS = [
  {
    title: "It is a first filter, not a final answer",
    body: "Academic Compass helps you find openings worth a closer look. It can miss listings, and listings can change after we collect them.",
  },
  {
    title: "Requirements come from the source page",
    body: "Every requirement is quoted from the page it came from. Listings with a star were checked by a person. Others were collected automatically and may be incomplete.",
  },
  {
    title: "Fixed rules decide eligibility. AI does not.",
    body: "We compare the quoted requirements with your profile using fixed rules. AI only reads pages and writes short summaries, and those summaries can be wrong.",
  },
  {
    title: "Always confirm before you apply",
    body: "Check the source page or contact the program before you rely on a result. A 'Not eligible' label should never stop you from asking.",
  },
];

function WelcomeInner() {
  const { user, refresh } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  async function go() {
    setBusy(true);
    try {
      await acceptDisclaimer();
      const me = await refresh();
      const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      if (me?.role === "student" && !me.has_profile) router.push("/onboarding");
      else if (me?.role === "admin" && dest === "/") router.push("/admin");
      else router.push(dest);
      setBusy(false);
      setAgreed(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <main className="ac-auth">
      <div className="ac-auth-card ac-auth-wide">
        <Logo />
        <p className="ac-eyebrow">Before you start</p>
        <h1>How to read your results</h1>
        <ol className="ac-points">
          {POINTS.map((p, i) => (
            <li key={i}>
              <span className="ac-point-num">{i + 1}</span>
              <div>
                <strong>{p.title}</strong>
                <p>{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <label className="ac-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I understand that results are a starting point and I will confirm details with the source.</span>
        </label>
        <button type="button" className="ac-btn ac-btn-primary ac-btn-block" disabled={!agreed || busy || !user} onClick={go}>
          {busy ? "One moment…" : "Continue"}
        </button>
      </div>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeInner />
    </Suspense>
  );
}
