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
  { username: "jordan", displayName: "Jordan Rivera", role: "student", blurb: "Biology junior · neuroscience research" },
  { username: "priya", displayName: "Priya Patel", role: "student", blurb: "Cog Sci transfer junior · data for social good" },
  { username: "admin", displayName: "Reviewer", role: "admin", blurb: "Verifies listings against their sources" },
] as const;

export function findDemoAccount(username: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.username === username);
}

export function demoEmail(username: string): string {
  return `${username}@demo.academic-compass.local`;
}
