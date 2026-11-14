// Browser-side API client for Academic Compass — use from "use client" components.
// Every function returns contract-shaped data (docs/contracts.md) or throws ApiError.
import type {
  ApplicationStatus,
  Bookmark,
  Category,
  MatchResult,
  Opportunity,
  OpportunityList,
  OpportunityStatus,
  OpportunityView,
  StudentProfile,
  StudentProfileInput,
} from "@/lib/client/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Which input field caused it — use to highlight the form field. */
    public field?: string,
  ) {
    super(message);
  }
}

// ───────── Temporary demo login (contracts §4) ─────────
// Every request carries `x-demo-user`. Remove this when Neon Auth replaces demo mode.
const DEMO_USER_KEY = "academic-compass-demo-user";
let demoUser: string | null = null;

export function getDemoUser(): string {
  if (demoUser) return demoUser;
  try {
    const saved = window.localStorage.getItem(DEMO_USER_KEY);
    if (saved) return (demoUser = saved);
  } catch {
    // storage unavailable (private mode, SSR) — fall back to default
  }
  return "demo";
}

/** Switch demo student (lowercase letters, digits, _ or -). Only fictional data! */
export function setDemoUser(name: string) {
  demoUser = name.trim().toLowerCase();
  try {
    window.localStorage.setItem(DEMO_USER_KEY, demoUser);
  } catch {
    // ignore
  }
}

type RequestOptions = { method?: string; json?: unknown; form?: FormData };

async function request<T>(path: string, { method = "GET", json, form }: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ "x-demo-user": getDemoUser() });
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  } else if (form) {
    body = form; // browser sets the multipart boundary itself
  }

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, cache: "no-store" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; field?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, e?.message ?? `Request failed (${res.status})`, e?.field);
  }
  return data as T;
}

// ───────── Opportunities (§4.1) ─────────
export interface OpportunityQuery {
  category?: Category | Category[];
  q?: string;
  sort?: "deadline" | "newest" | "relevance";
  status?: OpportunityStatus; // omit = hide expired + past deadlines
  page?: number;
  limit?: number; // max 100
}

export function getOpportunities(query: OpportunityQuery = {}): Promise<OpportunityList> {
  const p = new URLSearchParams();
  const cats = Array.isArray(query.category) ? query.category : query.category ? [query.category] : [];
  if (cats.length) p.set("category", cats.join(","));
  if (query.q?.trim()) p.set("q", query.q.trim());
  // "relevance" is applied client-side in loadDashboard; the list endpoint sorts by deadline.
  if (query.sort && query.sort !== "relevance") p.set("sort", query.sort);
  if (query.status) p.set("status", query.status);
  if (query.page) p.set("page", String(query.page));
  if (query.limit) p.set("limit", String(query.limit));
  const qs = p.toString();
  return request<OpportunityList>(`/api/opportunities${qs ? `?${qs}` : ""}`);
}

// ───────── Matching (§4.4) ─────────
/** Eligibility + relevance for the current demo student. Omit ids to match all open opportunities. */
export async function matchOpportunities(opportunityIds?: string[]): Promise<MatchResult[]> {
  const data = await request<{ results: MatchResult[] }>("/api/match", {
    method: "POST",
    json: opportunityIds ? { opportunity_ids: opportunityIds } : {},
  });
  return data.results;
}

/**
 * One call for the Dashboard: loads the list, then (if possible) adds match results.
 * Matching failures never break the page — you get the list plus `matchError`:
 *   PROFILE_NOT_FOUND → ask the student to finish onboarding
 *   AI_SERVICE_* / 503 → show "personalized ranking unavailable, try again later"
 */
export async function loadDashboard(query: OpportunityQuery = {}): Promise<{
  items: OpportunityView[];
  total: number;
  matchError: ApiError | null;
}> {
  const list = await getOpportunities({ ...query, limit: query.limit ?? 100 });
  let items: OpportunityView[] = list.items;
  let matchError: ApiError | null = null;

  if (list.items.length) {
    try {
      const results = await matchOpportunities(list.items.map((o) => o.opportunity_id));
      const byId = new Map(results.map((r) => [r.opportunity_id, r]));
      items = list.items.map((o) => ({ ...o, match: byId.get(o.opportunity_id) }));
    } catch (err) {
      matchError = err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", String(err));
    }
  }

  if (query.sort === "relevance") items = sortByRelevance(items);
  return { items, total: list.total, matchError };
}

/** Highest relevance first; null scores last; ties stay in deadline order. */
export function sortByRelevance(items: OpportunityView[]): OpportunityView[] {
  return [...items].sort((a, b) => (b.match?.relevance_score ?? -1) - (a.match?.relevance_score ?? -1));
}

// ───────── Profile (§4.2) ─────────
export async function getProfile(): Promise<StudentProfile | null> {
  return (await request<{ profile: StudentProfile | null }>("/api/profile")).profile;
}

/** Creates or REPLACES the whole profile. Send every field you want to keep. */
export async function saveProfile(input: Partial<StudentProfileInput>): Promise<StudentProfile> {
  return (await request<{ profile: StudentProfile }>("/api/profile", { method: "POST", json: input })).profile;
}

// ───────── Resume (§4.3) ─────────
/**
 * Parses a PDF (≤ 4MB). Nothing is saved — show the draft, let the student edit,
 * then call saveProfile(). useAi=true sends the text to Gemini: only with explicit consent.
 */
export async function parseResume(file: File, useAi: boolean): Promise<Partial<StudentProfile>> {
  if (file.size > 4 * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE", "The PDF must be 4MB or smaller", "file");
  const form = new FormData();
  form.append("file", file);
  form.append("use_ai", useAi ? "true" : "false");
  return (await request<{ extracted: Partial<StudentProfile> }>("/api/resume/parse", { method: "POST", form })).extracted;
}

// ───────── Bookmarks (§4.6) ─────────
export async function getBookmarks(): Promise<Bookmark[]> {
  return (await request<{ items: Bookmark[] }>("/api/bookmarks")).items;
}

export function saveBookmark(opportunityId: string, status: ApplicationStatus = "saved"): Promise<Bookmark> {
  return request<Bookmark>("/api/bookmarks", {
    method: "POST",
    json: { opportunity_id: opportunityId, application_status: status },
  });
}

export async function removeBookmark(opportunityId: string): Promise<void> {
  await request(`/api/bookmarks?opportunity_id=${encodeURIComponent(opportunityId)}`, { method: "DELETE" });
}

// ───────── Form helpers ─────────
/** "Python, SQL; pandas" → ["Python", "SQL", "pandas"] — for list fields typed as text. */
export function splitList(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
}

export function joinList(items: readonly string[] | null | undefined): string {
  return (items ?? []).join(", ");
}

/**
 * Fills EMPTY profile fields from a résumé draft and reports conflicts instead of overwriting.
 * Show `conflicts` to the student so they choose.
 */
export function mergeResumeDraft(
  current: Partial<StudentProfileInput>,
  draft: Partial<StudentProfile>,
): { merged: Partial<StudentProfileInput>; conflicts: { field: string; current: unknown; draft: unknown }[] } {
  const merged: Record<string, unknown> = { ...current };
  const conflicts: { field: string; current: unknown; draft: unknown }[] = [];
  for (const [field, value] of Object.entries(draft)) {
    if (field === "user_id" || field === "updated_at") continue;
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    const existing = merged[field];
    const isEmpty =
      existing === null || existing === undefined || existing === "" || (Array.isArray(existing) && existing.length === 0);
    if (isEmpty) merged[field] = value;
    else if (JSON.stringify(existing) !== JSON.stringify(value)) conflicts.push({ field, current: existing, draft: value });
  }
  return { merged: merged as Partial<StudentProfileInput>, conflicts };
}

export type { Opportunity };
