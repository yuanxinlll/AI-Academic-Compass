"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe, logout as apiLogout, type DemoAccountOption, type Me } from "@/lib/client/api";

type SessionState = {
  /** undefined = still loading, null = signed out */
  user: Me | null | undefined;
  accounts: DemoAccountOption[];
  refresh: () => Promise<Me | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null | undefined>(undefined);
  const [accounts, setAccounts] = useState<DemoAccountOption[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
      setAccounts(data.accounts);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => undefined);
    setUser(null);
  }, []);

  useEffect(() => {
    // Initial load of the session from /api/me (an external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ user, accounts, refresh, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/**
 * Sends signed-out visitors to /login and first-time users to the AI disclaimer.
 * `admin` additionally requires the admin account.
 */
export function RequireSignIn({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const blocked =
    user === null ? "login" : user && !user.disclaimer_accepted_at ? "welcome" : user && admin && user.role !== "admin" ? "home" : null;

  useEffect(() => {
    if (blocked === "login") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (blocked === "welcome") router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
    else if (blocked === "home") router.replace("/");
  }, [blocked, pathname, router]);

  if (user === undefined || blocked) {
    return (
      <main className="ac-center">
        <p className="ac-muted">Loading…</p>
      </main>
    );
  }
  return <>{children}</>;
}
