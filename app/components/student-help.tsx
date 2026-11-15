"use client";

import { useState } from "react";
import type { OpportunityView } from "@/lib/client/types";
import { reportOpportunity, type ReportReason } from "@/lib/client/api";

/* ------------------------------------------------------------------ */
/* Glossary: campus words a first-gen or international student may not */
/* have been taught. Fixed definitions, shown only when the listing    */
/* actually uses the word.                                             */
/* ------------------------------------------------------------------ */

const GLOSSARY: { term: string; match: RegExp; text: string }[] = [
  { term: "PI", match: /\bPIs?\b|principal investigator/i, text: "Principal investigator: the faculty member who runs the lab and decides who joins." },
  { term: "99 / 199", match: /\b(?:[A-Z]{2,5}[\s-]?)?(?:99H?|199)\b/, text: "Independent study courses where you earn units for research with a faculty member. 99 is for lower-division students, 199 for upper-division." },
  { term: "198", match: /\b(?:[A-Z]{2,5}[\s-]?)?198\b/, text: "Directed group study: a small, faculty-led group course, often used for team research projects." },
  { term: "TEA", match: /\bTEA\b|Triton Enrollment Authorization/, text: "Triton Enrollment Authorization: the online request in the Triton Student System you submit to get approved for courses like 99/199." },
  { term: "Units", match: /\bunits?\b/i, text: "Course credit. A full-time load is about 12 or more units a quarter. Many research courses expect about 30 hours of work per unit over the quarter." },
  { term: "Upper / lower division", match: /\b(?:upper|lower)[- ]division\b|\bUD course/i, text: "Lower-division courses are numbered 1–99, upper-division 100–199. \"Upper-division standing\" usually means you have finished about 90 units." },
  { term: "Quarter", match: /\bquarters?\b/i, text: "UC San Diego's 10-week terms: Fall, Winter and Spring, plus Summer Sessions." },
  { term: "Standing", match: /\b(?:sophomore|junior|senior|class) standing\b/i, text: "Your class level, counted by completed units rather than years in school." },
  { term: "GPA", match: /\bGPA\b|grade point average/i, text: "Grade point average on a 4.0 scale. Programs usually mean your UC San Diego GPA; incoming transfer students may be asked for their previous school's." },
  { term: "CV", match: /\bCV\b|curriculum vitae/i, text: "An academic résumé: education, research, skills, awards. For undergrads, a one-page résumé is usually fine." },
  { term: "Cover letter", match: /cover letter/i, text: "A short letter (half a page is plenty) saying why you are interested in this lab and what you can bring." },
  { term: "Postbacc", match: /post-?bacc/i, text: "Someone who has already finished a bachelor's degree, often gaining research experience before graduate school." },
  { term: "Postdoc", match: /\bpost-?doc/i, text: "A researcher with a PhD who works in the lab. Postdocs and grad students often supervise undergraduates day to day." },
  { term: "RA", match: /\bRAs?\b|research assistant/i, text: "Research assistant: an undergraduate helping with a lab's studies. It can be volunteer, for credit, or paid — the listing should say which." },
  { term: "REU", match: /\bREU\b|Research Experiences? for Undergraduates/i, text: "Research Experiences for Undergraduates: paid summer research programs funded by the U.S. National Science Foundation. NSF-funded spots are often limited to U.S. citizens and permanent residents — check the listing." },
  { term: "Stipend", match: /stipend|fellowship/i, text: "A fixed payment for taking part, rather than an hourly wage. It may count as taxable income." },
  { term: "Pell Grant", match: /\bPell\b/i, text: "A federal grant for students with financial need. \"Pell-eligible\" is often used to mean low-income." },
  { term: "Rolling", match: /\brolling\b/i, text: "Applications are reviewed as they arrive, so applying early helps even without a fixed deadline." },
  { term: "Handshake", match: /handshake/i, text: "UC San Diego's job and internship site, run by Career Services. Sign in with your student account." },
  { term: "REAL portal", match: /\bREAL\b/, text: "UC San Diego's portal for research and experiential-learning postings (real.ucsd.edu)." },
  { term: "Work authorization", match: /work authori[sz]ation|citizen|permanent resident/i, text: "Being legally allowed to work in the U.S. International students on F-1 or J-1 visas have limits on paid work — ask International Students & Programs (ISPO) before accepting a paid role." },
  { term: "Undocumented", match: /undocumented|AB ?540|DACA/i, text: "UC San Diego's Undocumented Student Services can tell you which programs and payments you qualify for." },
  { term: "Honors program / thesis", match: /honors (?:program|thesis)|senior thesis/i, text: "A year-long research project, usually in your major, that ends in a written thesis. Departments set their own GPA and course requirements." },
];

function textOf(item: OpportunityView) {
  return [
    item.title,
    item.description,
    item.application_method,
    item.deadline_text,
    ...(item.eligibility ?? []).map((r) => r.raw_text),
    ...Object.values(item.access ?? {}).map((f) => f?.quote ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
}

export function Glossary({ item }: { item: OpportunityView }) {
  const text = textOf(item);
  const terms = GLOSSARY.filter((g) => g.match.test(text));
  if (!terms.length) return null;
  return (
    <details className="ac-detail-section ac-glossary">
      <summary>
        <h3>Words on this listing</h3>
        <span className="ac-muted ac-small">{terms.length} explained</span>
      </summary>
      <dl>
        {terms.map((g) => (
          <div key={g.term}>
            <dt>{g.term}</dt>
            <dd>{g.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Reach-out guide: many labs only say "email the professor". This is  */
/* a fixed template, not AI-written. The student fills the brackets.   */
/* ------------------------------------------------------------------ */

const CONTACT = /e-?mail|contact|reach out|send (?:your|a|us)|@/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function needsOutreach(item: OpportunityView) {
  return CONTACT.test(item.application_method ?? "");
}

export function ReachOutGuide({ item }: { item: OpportunityView }) {
  const [copied, setCopied] = useState(false);
  if (!needsOutreach(item)) return null;
  const to = (item.application_method ?? "").match(EMAIL)?.[0];
  const where = item.organization ?? item.title;
  const asks = (item.application_method ?? "").match(/\b(CV|resume|résumé|transcript|cover letter|availability|coursework|references?)\b/gi);
  const subject = `Undergraduate research interest — ${where}`;
  const body = `Dear Professor [last name],

My name is [your name], a [year] [major] student at UC San Diego. I read about ${item.title} and I'm interested in [one project or paper from the lab's page] because [one sentence on why].

[One or two sentences on relevant coursework, skills or experience. It's fine if you haven't done research before.]

I can commit about [hours] hours a week starting [quarter]. Would you be open to a short meeting, or is there someone in the lab I should talk to? ${asks?.length ? `I've attached my ${[...new Set(asks.map((a) => a.toLowerCase()))].join(" and ")}.` : "My résumé is attached."}

Thank you for your time,
[your name]
[your UCSD email]`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the text is still on screen */
    }
  }

  return (
    <details className="ac-detail-section ac-reachout">
      <summary>
        <h3>How to reach out</h3>
        <span className="ac-muted ac-small">This listing asks you to contact them directly</span>
      </summary>
      <ol className="ac-steps">
        <li>Read the lab&apos;s research page and skim one recent paper or project, so you can say what interests you.</li>
        <li>
          Gather what they ask for{asks?.length ? <> — this listing mentions <strong>{[...new Set(asks.map((a) => a.toLowerCase()))].join(", ")}</strong></> : null}.
        </li>
        <li>Send a short email (below). Short and specific beats long and general.</li>
        <li>No reply after about two weeks? Send one polite follow-up, or ask a grad student or postdoc in the lab.</li>
        <li>Ask whether the spot is volunteer, for credit (99/199), or paid — it changes what you need to sign up for.</li>
      </ol>
      <div className="ac-template">
        <p className="ac-small">
          <strong>Subject:</strong> {subject}
        </p>
        <pre>{body}</pre>
        <div className="ac-detail-actions">
          <button type="button" className="ac-btn ac-btn-sm" onClick={copy}>
            {copied ? "Copied ✓" : "Copy template"}
          </button>
          {to ? (
            <a className="ac-btn ac-btn-sm" href={`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
              Open in email
            </a>
          ) : null}
        </div>
      </div>
      <p className="ac-fineprint">
        A fixed template, not AI-written. Replace every [bracket] in your own words. The{" "}
        <a href="https://ugresearch.ucsd.edu/" target="_blank" rel="noopener noreferrer">
          Undergraduate Research Hub
        </a>{" "}
        can also help you find a mentor.
      </p>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Add the deadline to a calendar.                                     */
/* ------------------------------------------------------------------ */

function ymd(iso: string, plusDays = 0) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function icsEscape(s: string) {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export function CalendarButtons({ item }: { item: OpportunityView }) {
  if (!item.deadline) return null;
  const title = `Deadline: ${item.title}`;
  const details = `${item.deadline_text ?? ""}\n\nSource: ${item.source_url}\n(Added from Academic Compass — check the source page for changes.)`.trim();
  const google =
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}` +
    `&dates=${ymd(item.deadline)}/${ymd(item.deadline, 1)}&details=${encodeURIComponent(details)}`;

  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Academic Compass//EN",
      "BEGIN:VEVENT",
      `UID:${item.opportunity_id}@academic-compass`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${ymd(item.deadline!)}`,
      `DTEND;VALUE=DATE:${ymd(item.deadline!, 1)}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(details)}`,
      `URL:${item.source_url}`,
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(`One week left: ${item.title}`)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title.replace(/[^\w]+/g, "-").slice(0, 60)}-deadline.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button type="button" className="ac-btn" onClick={downloadIcs}>
        Add to calendar
      </button>
      <a className="ac-btn ac-btn-ghost" href={google} target="_blank" rel="noopener noreferrer">
        Google Calendar ↗
      </a>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Report a problem: goes to the reviewers' queue.                     */
/* ------------------------------------------------------------------ */

const REASONS: { key: ReportReason; label: string }[] = [
  { key: "closed", label: "It's closed or full" },
  { key: "deadline", label: "Deadline is wrong" },
  { key: "requirements", label: "Requirements are wrong or missing" },
  { key: "who_can_apply", label: "Who can apply is wrong" },
  { key: "link", label: "Link is broken" },
  { key: "other", label: "Something else" },
];

export function ReportIssue({ item, signedIn }: { item: OpportunityView; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("closed");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  if (!signedIn) {
    return (
      <p className="ac-fineprint ac-report-link">
        Something wrong here? <a href="/login">Sign in</a> to tell a reviewer.
      </p>
    );
  }
  if (state === "done") {
    return <p className="ac-fineprint ac-report-link">Thanks — a reviewer will check this listing against its source.</p>;
  }
  if (!open) {
    return (
      <p className="ac-fineprint ac-report-link">
        <button type="button" className="ac-linkbtn" onClick={() => setOpen(true)}>
          Report a problem with this listing
        </button>
      </p>
    );
  }
  return (
    <form
      className="ac-detail-section ac-report"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        try {
          await reportOpportunity(item.opportunity_id, reason, note.trim());
          setState("done");
        } catch {
          setState("error");
        }
      }}
    >
      <h3>What&apos;s wrong?</h3>
      <div className="ac-chips">
        {REASONS.map((r) => (
          <button key={r.key} type="button" className="ac-chip" aria-pressed={reason === r.key} onClick={() => setReason(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        className="ac-input"
        rows={3}
        maxLength={500}
        placeholder="Optional: what does the source page actually say?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {state === "error" ? <p className="ac-error">Could not send that. Try again.</p> : null}
      <div className="ac-detail-actions">
        <button type="submit" className="ac-btn ac-btn-primary ac-btn-sm" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Send to reviewers"}
        </button>
        <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
