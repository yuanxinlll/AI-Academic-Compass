"use client";

import { useEffect, useMemo, useState } from "react";
import type { Opportunity } from "@/lib/client/types";
import { CATEGORY_LABELS } from "@/lib/client/types";
import { REQUIREMENT_LABELS, formatDate } from "@/lib/client/labels";
import NavBar from "../../components/nav-bar";
import { AdminSearch, matchesQuery } from "../admin-search";
import { RequireSignIn } from "../../components/session";

type Field = { key: string; label: string; verdicts: string[] };
type Item = Opportunity & { split: "dev" | "test"; labels: Record<string, { verdict: string }> };
type Summary = {
  test: { listings: number; fields: { key: string; label: string; correct: number; of: number }[] };
  dev: { listings: number; fields: { key: string; label: string; correct: number; of: number }[] };
  failures: { split: string; field: string; verdict: string; title: string }[];
};

const VERDICT_TEXT: Record<string, string> = { correct: "Correct", wrong: "Wrong", missing: "Missed", na: "Not on page" };

function shown(o: Item, key: string): string {
  switch (key) {
    case "title":
      return `${o.title}${o.organization ? ` — ${o.organization}` : ""}`;
    case "category":
      return CATEGORY_LABELS[o.category];
    case "deadline":
      return o.deadline ? formatDate(o.deadline) : o.deadline_text ?? "(none extracted)";
    case "requirements_complete":
    case "requirement_quotes":
      return o.eligibility.length
        ? o.eligibility.map((r) => `${REQUIREMENT_LABELS[r.type] ?? r.type}${r.is_hard_requirement ? "" : " (preferred)"}: “${r.raw_text}”`).join("\n")
        : "(no requirements extracted)";
    case "apply_method":
      return o.application_method ?? "(none extracted)";
    case "international": {
      const f = o.access?.international;
      return f ? `${f.value}${f.quote ? ` — “${f.quote}”` : ""}` : "(not checked yet)";
    }
    default:
      return "";
  }
}

function EvalInner() {
  const [fields, setFields] = useState<Field[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [onlyTodo, setOnlyTodo] = useState(true);
  const [q, setQ] = useState("");

  const loadSummary = () => fetch("/api/eval-summary", { cache: "no-store" }).then(async (r) => r.ok && setSummary(await r.json()));
  useEffect(() => {
    fetch("/api/admin/eval", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setFields(d.fields);
      setItems(d.items);
    });
    void loadSummary();
  }, []);

  const queue = useMemo(
    () =>
      (onlyTodo ? items.filter((o) => Object.keys(o.labels).length < fields.length) : items).filter((o) => matchesQuery(o, q)),
    [items, fields, onlyTodo, q],
  );
  const cur = queue[Math.min(idx, Math.max(0, queue.length - 1))];
  const labeled = items.filter((o) => Object.keys(o.labels).length >= fields.length && fields.length).length;

  async function label(o: Item, field: string, verdict: string) {
    setItems((list) => list.map((x) => (x.opportunity_id === o.opportunity_id ? { ...x, labels: { ...x.labels, [field]: { verdict } } } : x)));
    await fetch("/api/admin/eval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunity_id: o.opportunity_id, field, verdict }),
    });
    void loadSummary();
  }

  return (
    <>
      <NavBar />
      <main className="ac-page">
        <section className="ac-section">
          <div className="ac-section-head">
            <div>
              <p className="ac-eyebrow">Evaluation</p>
              <h1 className="ac-h1">Check extraction against the source</h1>
            </div>
            <p className="ac-muted">
              {labeled} of {items.length} listings fully labeled
            </p>
          </div>
          <p className="ac-muted">
            Open the source page, then mark each field. The dev/test split is fixed from the listing id before anyone looks,
            so we never tune prompts on test results. Only <strong>test</strong> listings count in the reported numbers.
          </p>
          <label className="ac-switch">
            <input type="checkbox" checked={onlyTodo} onChange={(e) => { setOnlyTodo(e.target.checked); setIdx(0); }} />
            <span>Only show unfinished</span>
          </label>
          <AdminSearch
            value={q}
            onChange={(v) => { setQ(v); setIdx(0); }}
            count={q ? `${queue.length} match${queue.length === 1 ? "" : "es"}${onlyTodo ? " (unfinished only)" : ""}` : undefined}
          />
        </section>

        {cur ? (
          <section className="ac-panel-card ac-eval">
            <div className="ac-card-top">
              <span className={`ac-tag ${cur.split === "test" ? "ac-tone-amber" : "ac-tone-muted"}`}>{cur.split} set</span>
              <a className="ac-btn ac-btn-primary ac-btn-sm" href={cur.source_url} target="_blank" rel="noopener noreferrer">
                Open source page ↗
              </a>
              <span className="ac-muted ac-small">
                {Math.min(idx, queue.length - 1) + 1} / {queue.length}
              </span>
            </div>
            <ul className="ac-reqs">
              {fields.map((f) => (
                <li key={f.key} className="ac-req">
                  <div className="ac-req-head">
                    <span className="ac-req-type">{f.label}</span>
                  </div>
                  <pre className="ac-eval-value">{shown(cur, f.key)}</pre>
                  <div className="ac-eval-verdicts">
                    {f.verdicts.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`ac-chip ${cur.labels[f.key]?.verdict === v ? `ac-tone-${v === "correct" ? "green" : v === "na" ? "muted" : "red"}` : ""}`}
                        aria-pressed={cur.labels[f.key]?.verdict === v}
                        onClick={() => label(cur, f.key, v)}
                      >
                        {VERDICT_TEXT[v]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="ac-detail-actions">
              <button type="button" className="ac-btn" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                ← Previous
              </button>
              <button type="button" className="ac-btn ac-btn-primary" onClick={() => setIdx((i) => Math.min(queue.length - 1, i + 1))}>
                Next →
              </button>
            </div>
          </section>
        ) : (
          <p className="ac-empty">{q ? `Nothing matches “${q}”${onlyTodo ? " among unfinished listings" : ""}.` : "Nothing left to label."}</p>
        )}

        {summary ? (
          <section className="ac-section">
            <div className="ac-section-head">
              <h2>Results on the test set ({summary.test.listings} listings)</h2>
            </div>
            <div className="ac-panel-card ac-gap-transparency">
              {summary.test.fields.map((f) => (
                <div key={f.key} className="ac-gap-trow">
                  <span>{f.label}</span>
                  <div className="ac-relevance-bar ac-bar-wide" aria-hidden="true">
                    <span style={{ width: `${f.of ? (100 * f.correct) / f.of : 0}%` }} />
                  </div>
                  <span className="ac-gap-pct">
                    {f.correct} of {f.of}
                  </span>
                </div>
              ))}
            </div>
            {summary.failures.filter((x) => x.split === "test").length ? (
              <div className="ac-panel-card">
                <h2>Test-set failures (published as-is)</h2>
                <ul className="ac-bullets">
                  {summary.failures
                    .filter((x) => x.split === "test")
                    .map((x, i) => (
                      <li key={i}>
                        {VERDICT_TEXT[x.verdict]} · {fields.find((f) => f.key === x.field)?.label ?? x.field} · {x.title}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </>
  );
}

export default function EvalPage() {
  return (
    <RequireSignIn admin>
      <EvalInner />
    </RequireSignIn>
  );
}
