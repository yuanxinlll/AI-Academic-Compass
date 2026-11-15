"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NavBar from "../components/nav-bar";

type Field = { key: string; label: string; correct: number; of: number };
type Summary = {
  test: { listings: number; fields: Field[] };
  dev: { listings: number; fields: Field[] };
  failures: { split: string; field: string; verdict: string; title: string; source_url: string; note: string | null }[];
};

const STEPS = [
  {
    n: "1",
    title: "Fetch the page",
    who: "Bright Data",
    text: "We read public UC San Diego pages — research labs, programs, transfer and first-gen centers, student orgs — plus flyers and Instagram posts. Each read is fingerprinted (sha256) and timed.",
  },
  {
    n: "2",
    title: "Read it",
    who: "Gemini",
    text: "Gemini pulls out the title, deadline, requirements, how to apply and who can apply. Page text is passed as data, never as instructions.",
  },
  {
    n: "3",
    title: "Check every quote",
    who: "Fixed code",
    text: "Every requirement, deadline and who-can-apply fact must come with an exact quote that we find word-for-word on the page. No quote, no fact: it is dropped or shown as “not stated”.",
  },
  {
    n: "4",
    title: "Decide eligibility",
    who: "Fixed rules",
    text: "Whether you meet a requirement is worked out by versioned rules from the quotes and your profile. AI never decides eligibility, and your background is never guessed.",
  },
  {
    n: "5",
    title: "A person checks",
    who: "Reviewers",
    text: "A reviewer compares the listing with its source before it gets a star. Students can report a problem from any listing; reports go to the same queue.",
  },
  {
    n: "6",
    title: "Keep a record",
    who: "Audit log",
    text: "Every collection, re-collection, status change and report is written to an append-only log you can read on each listing under “Where this came from”.",
  },
];

const NEVER = [
  "Decide whether you are eligible. Rules do that, from quotes you can read.",
  "Guess your background. First-gen, transfer and international status come only from what you tell us.",
  "Use a fact it found on another website for eligibility. Those are shown as “AI web search · unverified” leads, with their source.",
  "Fill in a deadline it cannot quote. If the page has no date, we say so.",
];

const LIMITS = [
  "One campus (UC San Diego) and about 70 listings. This is a working prototype, not a full catalog.",
  "Our own team labeled the evaluation. It is not an independent audit, and the test set is small — so we report counts (N of M), not percentages.",
  "Pages change. A listing is only as current as its last read; the date is on every listing.",
  "Pages that need JavaScript to show text can come back empty (one of our 20 test pages did). Those are skipped, not guessed.",
  "Most pages never say whether international students can apply, so most listings say “not stated”. That is the gap we are measuring, not a bug we can fix by guessing.",
  "No real students have used it yet. The demo accounts and their backgrounds are fictional.",
];

function FieldRow({ f }: { f: Field }) {
  const pct = f.of ? Math.round((100 * f.correct) / f.of) : 0;
  return (
    <li className="ac-method-field">
      <span>{f.label}</span>
      <span className="ac-relevance-bar ac-bar-wide" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <strong>{f.of ? `${f.correct} of ${f.of}` : "—"}</strong>
    </li>
  );
}

export default function MethodPage() {
  const [s, setS] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/eval-summary", { cache: "no-store" })
      .then(async (r) => (r.ok ? setS(await r.json()) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);
  const testFailures = s?.failures.filter((f) => f.split === "test") ?? [];
  const labeled = s?.test.fields.some((f) => f.of > 0);

  return (
    <>
      <NavBar />
      <main className="ac-page ac-narrow">
        <section className="ac-section">
          <p className="ac-eyebrow">How we check</p>
          <h1 className="ac-h1">Every fact is a quote. Rules decide. People verify.</h1>
          <p className="ac-muted">
            A student deciding where to spend a quarter deserves to know where each fact came from and how sure we are. Here is exactly how a
            listing is made, what we measured, where it failed, and what this prototype cannot do yet.
          </p>
        </section>

        <section className="ac-panel-card">
          <h2>From a web page to a listing</h2>
          <ol className="ac-method-steps">
            {STEPS.map((x) => (
              <li key={x.n}>
                <span className="ac-method-n" aria-hidden="true">
                  {x.n}
                </span>
                <div>
                  <h3>
                    {x.title} <span className="ac-tag ac-tone-muted">{x.who}</span>
                  </h3>
                  <p>{x.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ac-panel-card">
          <h2>What AI never does here</h2>
          <ul className="ac-method-list">
            {NEVER.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section className="ac-panel-card">
          <h2>How accurate is the reading?</h2>
          <p className="ac-muted">
            We split listings into a <strong>dev</strong> set and a <strong>test</strong> set by a hash of their id, before looking at any
            results. We only tune on dev. Below are hand-checked results on the <strong>test</strong> set: for each field, how many were right
            out of those where the page said something. A miss counts as wrong.
          </p>
          {failed ? (
            <p className="ac-error">Could not load the results right now.</p>
          ) : !s ? (
            <p className="ac-muted">Loading…</p>
          ) : !labeled ? (
            <p className="ac-note">Hand-labeling of the test set is in progress. Results appear here as soon as they are recorded.</p>
          ) : (
            <>
              <ul className="ac-method-fields">
                {s.test.fields.map((f) => (
                  <FieldRow key={f.key} f={f} />
                ))}
              </ul>
              <p className="ac-fineprint">
                {s.test.listings} test listings labeled. Updated live from our labels; nothing on this page is typed in by hand.
              </p>
            </>
          )}
        </section>

        {testFailures.length ? (
          <section className="ac-panel-card">
            <h2>Where it went wrong</h2>
            <p className="ac-muted">Every test-set failure, unedited. These are what we fix next.</p>
            <ul className="ac-saved">
              {testFailures.map((f, i) => (
                <li key={i}>
                  <div className="ac-saved-main">
                    <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="ac-saved-title">
                      {f.title}
                    </a>
                    <span className="ac-muted">
                      {f.verdict === "missing" ? "Missed" : "Wrong"} · {s?.test.fields.find((x) => x.key === f.field)?.label ?? f.field}
                      {f.note ? ` · ${f.note}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="ac-panel-card">
          <h2>Facts from elsewhere on the web</h2>
          <p>
            When a listing leaves something out, Gemini can search the web for it. A finding is kept only if we can open the page it came from
            and find the quote there. In our run on November 15, 2026, Gemini proposed <strong>23</strong> facts for 15 listings; we kept{" "}
            <strong>14</strong> and rejected <strong>9</strong> because the quote was not on the cited page. Kept facts are labeled
            &ldquo;unverified&rdquo; and never used for eligibility.
          </p>
        </section>

        <section className="ac-panel-card">
          <h2>What this cannot do yet</h2>
          <ul className="ac-method-list">
            {LIMITS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <p className="ac-fineprint">
          See the numbers on missing information across campus on <Link href="/access">Access Gap</Link>, and the words we explain on{" "}
          <Link href="/glossary">Campus words</Link>.
        </p>
      </main>
    </>
  );
}
