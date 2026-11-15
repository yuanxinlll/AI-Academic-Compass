"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackground, getBookmarks, getProfile, removeBookmark, saveBackground, saveBookmark, type Background } from "@/lib/client/api";
import {
  ACADEMIC_YEAR_LABELS,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  CATEGORY_LABELS,
  type ApplicationStatus,
  type Bookmark,
  type StudentProfile,
} from "@/lib/client/types";
import { deadlineBadge } from "@/lib/client/labels";
import { Logo } from "../components/nav-bar";
import { RequireSignIn, useSession } from "../components/session";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

const BG_FIELDS: { key: keyof Background; label: string }[] = [
  { key: "first_generation", label: "First in my family to go to college" },
  { key: "transfer_student", label: "Transferred from a community college" },
  { key: "international_student", label: "International student" },
];

function BackgroundCard() {
  const [bg, setBg] = useState<Background | null | undefined>(undefined);
  useEffect(() => {
    getBackground().then(setBg).catch(() => setBg(null));
  }, []);
  if (!bg) return null;
  async function set(key: keyof Background, value: boolean | null) {
    const next = { ...bg!, [key]: value };
    setBg(next);
    await saveBackground(next).catch(() => undefined);
  }
  return (
    <section className="ac-panel-card">
      <h2>Background (optional)</h2>
      <p className="ac-muted ac-small">
        Only you see this. We use it to point out programs made for students like you, and only as anonymous totals on
        the Access Gap page. We never guess it.
      </p>
      <div className="ac-bg-rows">
        {BG_FIELDS.map((f) => (
          <div key={f.key} className="ac-bg-row">
            <span>{f.label}</span>
            <select
              className="ac-select"
              value={bg[f.key] === null ? "" : bg[f.key] ? "yes" : "no"}
              onChange={(e) => set(f.key, e.target.value === "" ? null : e.target.value === "yes")}
            >
              <option value="">Prefer not to say</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

function MeInner() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null | undefined>(undefined);
  const [saved, setSaved] = useState<Bookmark[] | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
    getBookmarks().then(setSaved).catch(() => setSaved([]));
  }, []);

  async function setStatus(b: Bookmark, status: ApplicationStatus) {
    setSaved((list) => list?.map((x) => (x === b ? { ...x, application_status: status } : x)) ?? null);
    await saveBookmark(b.opportunity.opportunity_id, status).catch(() => undefined);
  }

  async function remove(b: Bookmark) {
    setSaved((list) => list?.filter((x) => x !== b) ?? null);
    await removeBookmark(b.opportunity.opportunity_id).catch(() => undefined);
  }

  return (
    <main className="ac-page ac-me">
      <header className="ac-me-head">
        <Link href="/" className="ac-link">
          ← Back
        </Link>
        <Logo />
      </header>

      <section className="ac-panel-card ac-me-hero">
        <span className="ac-avatar ac-avatar-xl" aria-hidden="true">
          {user?.display_name.slice(0, 1)}
        </span>
        <div>
          <h1>{user?.display_name}</h1>
          <p className="ac-muted">
            {user?.role === "admin" ? "Reviewer account" : "Demo student"} · all data in this account is fictional
          </p>
        </div>
        <div className="ac-me-actions">
          {user?.role === "student" ? (
            <Link href="/onboarding" className="ac-btn">
              Edit profile
            </Link>
          ) : (
            <Link href="/admin" className="ac-btn">
              Review queue
            </Link>
          )}
          <button
            type="button"
            className="ac-btn ac-btn-ghost"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            Sign out
          </button>
        </div>
      </section>

      {user?.role === "student" ? (
        <section className="ac-panel-card">
          <h2>Profile</h2>
          {profile === undefined ? (
            <p className="ac-muted">Loading…</p>
          ) : profile === null ? (
            <p>
              No profile yet. <Link href="/onboarding">Build one</Link> to see personal results.
            </p>
          ) : (
            <dl className="ac-meta ac-meta-wide">
              <Field label="Major" value={[profile.major, profile.minor && `minor in ${profile.minor}`].filter(Boolean).join(", ")} />
              <Field label="Year" value={profile.academic_year ? ACADEMIC_YEAR_LABELS[profile.academic_year] : null} />
              <Field label="Graduating" value={profile.expected_graduation} />
              <Field label="Interests" value={[...new Set([...profile.interests, ...profile.research_areas].map((x) => x.trim()))].join(", ")} />
              <Field label="Skills" value={profile.skills.join(", ")} />
              <Field label="Looking for" value={profile.selected_modules.map((c) => CATEGORY_LABELS[c]).join(", ")} />
              <Field label="Hours per week" value={profile.hours_per_week?.toString()} />
            </dl>
          )}
        </section>
      ) : null}

      {user?.role === "student" ? <BackgroundCard /> : null}

      <section className="ac-panel-card">
        <div className="ac-section-head">
          <h2>Saved</h2>
          {user?.role === "student" ? (
            <Link href="/calendar" className="ac-btn ac-btn-sm">
              Open calendar
            </Link>
          ) : null}
        </div>
        {saved === null ? (
          <p className="ac-muted">Loading…</p>
        ) : saved.length === 0 ? (
          <p className="ac-muted">
            Nothing saved yet. Tap the bookmark on any card in <Link href="/search">Explore</Link>.
          </p>
        ) : (
          <ul className="ac-saved">
            {saved.map((b) => {
              const d = deadlineBadge(b.opportunity);
              return (
                <li key={b.opportunity.opportunity_id}>
                  <div className="ac-saved-main">
                    <Link href={`/opportunities/${b.opportunity.opportunity_id}`} className="ac-saved-title">
                      {b.opportunity.title}
                    </Link>
                    <span className="ac-muted">
                      {CATEGORY_LABELS[b.opportunity.category]}
                      {b.opportunity.organization ? ` · ${b.opportunity.organization}` : ""}
                    </span>
                  </div>
                  {d ? <span className={`ac-tag ac-tone-${d.tone}`}>{d.label}</span> : null}
                  <select
                    className="ac-select"
                    value={b.application_status}
                    onChange={(e) => setStatus(b, e.target.value as ApplicationStatus)}
                    aria-label="Application status"
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {APPLICATION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={() => remove(b)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function MePage() {
  return (
    <RequireSignIn>
      <MeInner />
    </RequireSignIn>
  );
}
