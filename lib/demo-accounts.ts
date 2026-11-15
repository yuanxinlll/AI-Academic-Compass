// Fixed demo accounts (plan: "demo accounts only"; Neon Auth is P2).
// All profile data for these accounts is fictional.
export type Role = "student" | "admin";

export type DemoAccount = {
  username: string;
  displayName: string;
  role: Role;
  /** One-line description shown on the login picker. */
  blurb: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { username: "maya", displayName: "Maya Chen", role: "student", blurb: "CS sophomore · machine learning, HCI" },
  { username: "jordan", displayName: "Jordan Rivera", role: "student", blurb: "First-gen Biology junior · neuroscience" },
  { username: "priya", displayName: "Priya Patel", role: "student", blurb: "Community college transfer · Cog Sci · data for good" },
  { username: "wei", displayName: "Wei Zhang", role: "student", blurb: "International student (F-1) · Data Science junior" },
  { username: "admin", displayName: "Reviewer", role: "admin", blurb: "Verifies listings against their sources" },
] as const;

export function findDemoAccount(username: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.username === username);
}

export function demoEmail(username: string): string {
  return `${username}@demo.academic-compass.local`;
}
