"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login } from "@/lib/client/api";
import { Logo } from "../components/nav-bar";
import { useSession } from "../components/session";

function LoginInner() {
  const { accounts, refresh } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState("");

  async function signIn(username: string) {
    setBusy(username);
    setError(null);
    try {
      const me = await login(username, username === "admin" ? password : undefined);
      await refresh();
      const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      if (!me.disclaimer_accepted_at) router.push(`/welcome?next=${encodeURIComponent(dest)}`);
      else if (me.role === "admin" && dest === "/") router.push("/admin");
      else router.push(dest);
      // Next.js keeps visited pages alive (state is preserved), so reset for the next visit.
      setBusy(null);
      setPassword("");
      setNeedPassword(false);
    } catch (err) {
      if (err instanceof ApiError && err.field === "password") {
        setNeedPassword(true);
        setError(password ? "That password is not right." : "The reviewer account needs a password.");
      } else setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(null);
    }
  }

  const students = accounts.filter((a) => a.role === "student");
  const admin = accounts.find((a) => a.role === "admin");

  return (
    <main className="ac-auth">
      <div className="ac-auth-card">
        <Logo />
        <h1>Choose a demo account</h1>
        <p className="ac-muted">
          This is a hackathon demo. Each student below is fictional and already has a profile, so you can see
          personal results right away.
        </p>
        <div className="ac-accounts">
          {students.map((a) => (
            <button key={a.username} type="button" className="ac-account" onClick={() => signIn(a.username)} disabled={busy !== null}>
              <span className="ac-avatar ac-avatar-lg" aria-hidden="true">
                {a.display_name.slice(0, 1)}
              </span>
              <span className="ac-account-text">
                <strong>{a.display_name}</strong>
                <span>{a.blurb}</span>
              </span>
              <span className="ac-account-go">{busy === a.username ? "…" : "→"}</span>
            </button>
          ))}
        </div>
        {admin ? (
          <div className="ac-admin-login">
            <p className="ac-muted">
              <strong>{admin.display_name}</strong> · {admin.blurb}
            </p>
            {needPassword ? (
              <input
                type="password"
                className="ac-input"
                placeholder="Reviewer password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signIn(admin.username)}
                autoFocus
              />
            ) : null}
            <button type="button" className="ac-btn" onClick={() => signIn(admin.username)} disabled={busy !== null}>
              {busy === admin.username ? "Signing in…" : "Sign in as reviewer"}
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="ac-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
