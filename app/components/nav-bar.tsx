"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./session";

export function Logo() {
  return (
    <Link href="/" className="ac-logo" aria-label="Academic Compass home">
      <Image src="/logo.png" alt="" width={28} height={28} className="ac-logo-img" priority />
      <span>Academic Compass</span>
    </Link>
  );
}

export function UserMenu() {
  const { user } = useSession();
  if (user === undefined) return <span className="ac-nav-placeholder" />;
  if (!user)
    return (
      <Link href="/login" className="ac-btn ac-btn-primary ac-btn-sm">
        Sign in
      </Link>
    );
  return (
    <Link href="/me" className="ac-user-chip" title="Your profile and saved opportunities">
      <span className="ac-avatar" aria-hidden="true">
        {user.display_name.slice(0, 1)}
      </span>
      <span className="ac-user-name">{user.display_name}</span>
    </Link>
  );
}

export default function NavBar() {
  const { user } = useSession();
  const pathname = usePathname();
  const links = [
    { href: "/search", label: "Explore" },
    { href: "/access", label: "Access Gap" },
    ...(user ? [{ href: "/me", label: "Saved" }] : []),
    ...(user?.role === "admin"
      ? [
          { href: "/admin", label: "Review queue" },
          { href: "/admin/eval", label: "Evaluation" },
        ]
      : []),
  ];
  return (
    <header className="ac-nav">
      <div className="ac-nav-inner">
        <Logo />
        <nav className="ac-nav-links" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="ac-nav-link" aria-current={pathname === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}
