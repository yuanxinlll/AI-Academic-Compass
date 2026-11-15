"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NavBar from "../components/nav-bar";

type Persona = {
  username: string;
  label: string;
  detail: string;
  counts: Record<string, number>;
  open_to_apply: number;
  paid_open: number;
  designed_for: number;
  closed_by_citizenship: number;
  unclear_for_them: number;
};
type Gap = {
  generated_at: string;
  total_open: number;
  transparency: { key: string; label: string; count: number; pct: number }[];
  access: {
    international_open: number;
    international_restricted: number;
    international_unstated: number;
    first_gen_focus: number;
    transfer_focus: number;
    paid_or_stipend: number;
    verified: number;
    by_source_kind: Record<string, number>;
  };
  buckets: string[];
  personas: Persona[] | null;
  persona_error: string | null;
  caveat: string;
};

const TONE: Record<string, string> = {
  Eligible: "green",
  "Likely eligible": "teal",
  "Check requirements": "amber",
  "Likely not eligible": "orange",
  "Not eligible": "red",
};

export default function AccessGapPage() {
  const [gap, setGap] = useState<Gap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/access-gap", { cache: "no-store" })
      .then(async (r) => (r.ok ? setGap(await r.json()) : setError("Could not load the numbers.")))
      .catch(() => setError("Could not load the numbers."));
  }, []);

  const n = gap?.total_open ?? 0;
  const intlStated = gap ? n - gap.access.international_unstated : 0;

  return (
    <>
      <NavBar />
      <main className="ac-page">
        <section className="ac-hero ac-hero-left">
          <p className="ac-eyebrow">Data for Good · Access Gap</p>
          <h1 className="ac-h1-xl">Same campus. Different doors.</h1>
          <p className="ac-lede">
            We ran the same open listings past four fictional UC San Diego students: a typical student, a first-generation
            student, a community college transfer and an international student. Then we counted how often listings even say
            the things those students need to know.
          </p>
        </section>

        {error ? <p className="ac-error">{error}</p> : null}
        {!gap && !error ? <div className="ac-skeleton-grid" aria-label="Loading" /> : null}

        {gap ? (
          <>
            <dl className="ac-stats ac-stats-wide">
              <div>
                <dt>Open listings analyzed</dt>
                <dd>{n}</dd>
              </div>
              <div>
                <dt>Say if international students can apply</dt>
                <dd>
                  {intlStated}
                  <span className="ac-stat-of"> / {n}</span>
                </dd>
              </div>
              <div>
                <dt>Made for first-gen or transfer students</dt>
                <dd>{gap.access.first_gen_focus + gap.access.transfer_focus}</dd>
              </div>
              <div>
                <dt>Paid or with a stipend</dt>
                <dd>{gap.access.paid_or_stipend}</dd>
              </div>
            </dl>

            <section className="ac-section">
              <div className="ac-section-head">
                <h2>What each student can actually apply to</h2>
              </div>
              {gap.personas ? (
                <div className="ac-panel-card ac-gap-personas">
                  {gap.personas.map((p) => {
                    const total = Object.values(p.counts).reduce((a, b) => a + b, 0) || 1;
                    return (
                      <div key={p.username} className="ac-gap-row">
                        <div className="ac-gap-who">
                          <strong>{p.label}</strong>
                          <span className="ac-muted ac-small">{p.detail}</span>
                        </div>
                        <div className="ac-gap-bar" role="img" aria-label={gap.buckets.map((b) => `${b}: ${p.counts[b]}`).join(", ")}>
                          {gap.buckets.map((b) =>
                            p.counts[b] ? (
                              <span
                                key={b}
                                className={`ac-gap-seg ac-tone-${TONE[b]}`}
                                style={{ width: `${(100 * p.counts[b]) / total}%` }}
                                title={`${b}: ${p.counts[b]}`}
                              >
                                {p.counts[b]}
                              </span>
                            ) : null,
                          )}
                        </div>
                        <div className="ac-gap-notes ac-small">
                          <span>
                            <strong>{p.open_to_apply}</strong> worth applying to
                          </span>
                          <span>
                            <strong>{p.paid_open}</strong> paid
                          </span>
                          {p.designed_for ? (
                            <span>
                              <strong>{p.designed_for}</strong> made for them
                            </span>
                          ) : null}
                          {p.closed_by_citizenship ? (
                            <span className="ac-gap-warn">
                              <strong>{p.closed_by_citizenship}</strong> need U.S. citizenship or work authorization
                            </span>
                          ) : null}
                          {p.unclear_for_them ? (
                            <span className="ac-gap-warn">
                              <strong>{p.unclear_for_them}</strong> don&apos;t say if they can apply
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div className="ac-gap-legend ac-small">
                    {gap.buckets.map((b) => (
                      <span key={b}>
                        <i className={`ac-tone-${TONE[b]}`} /> {b}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="ac-note">Persona matching is unavailable right now. The transparency numbers below are still live.</p>
              )}
            </section>

            <section className="ac-section">
              <div className="ac-section-head">
                <h2>How often listings say what students need</h2>
              </div>
              <div className="ac-panel-card ac-gap-transparency">
                {gap.transparency.map((t) => (
                  <div key={t.key} className="ac-gap-trow">
                    <span>{t.label}</span>
                    <div className="ac-relevance-bar ac-bar-wide" aria-hidden="true">
                      <span style={{ width: `${t.pct}%` }} />
                    </div>
                    <span className="ac-gap-pct">
                      {t.count}/{n} · {t.pct}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="ac-fineprint">
                Every “says” above means our collector found an exact quote on the source page. If a page is silent, a
                first-gen or international student has to email someone to find out — that silence is the gap.
              </p>
            </section>

            <section className="ac-section">
              <div className="ac-section-head">
                <h2>How we got these numbers</h2>
              </div>
              <div className="ac-panel-card">
                <ul className="ac-bullets">
                  <li>Listings come from public UC San Diego pages, event flyers and student-organization posts, collected with Bright Data and read by Gemini.</li>
                  <li>
                    Each “who can apply” fact must be an exact quote from the page. No quote → “unstated”. Nothing is inferred
                    from a program&apos;s name or field.
                  </li>
                  <li>Eligibility for each student comes from fixed rules, the same ones students see on every card.</li>
                  <li>
                    {gap.access.verified} of {n} listings have been checked by a person. The rest are labeled “not yet
                    verified”.
                  </li>
                  <li>{gap.caveat}</li>
                </ul>
                <p className="ac-fineprint">
                  Updated {new Date(gap.generated_at).toLocaleString()} · <Link href="/search">Browse the listings</Link>
                </p>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
