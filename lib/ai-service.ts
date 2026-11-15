import { AiServiceError } from "@/lib/api";

// Client for B's stateless Python service — docs/contracts.md §8.
// Server-side only: INTERNAL_TOKEN must never reach the browser.
export async function callAiService(
  path: "/internal/match" | "/internal/resume/parse",
  body: FormData | object,
  timeoutMs = 45_000, // per services/D_HANDOFF.md
): Promise<unknown> {
  const base = process.env.AI_SERVICE_URL?.replace(/\/+$/, "");
  const token = process.env.INTERNAL_TOKEN;
  if (!base || !token) {
    throw new AiServiceError(503, "AI_SERVICE_NOT_CONFIGURED", "The AI service is not configured yet");
  }

  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: "POST",
      headers: { "x-internal-token": token, ...(isForm ? {} : { "content-type": "application/json" }) },
      body: isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new AiServiceError(
      timedOut ? 504 : 502,
      timedOut ? "AI_SERVICE_TIMEOUT" : "AI_SERVICE_UNREACHABLE",
      timedOut ? "The AI service took too long to respond" : "Could not reach the AI service",
    );
  }

  const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
  const data: unknown = isHtml ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (isHtml) {
      // Vercel Deployment Protection page, not B's JSON auth.
      throw new AiServiceError(502, "AI_SERVICE_PROTECTED", "AI service is behind platform access protection");
    }
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    const code = e?.code ?? "AI_SERVICE_ERROR";
    // 401/403 from B means OUR server token is wrong — never surface it as "user not logged in".
    if (res.status === 401 || res.status === 403) {
      console.error("[ai-service] INTERNAL_TOKEN rejected by AI service");
      throw new AiServiceError(502, "AI_SERVICE_AUTH_FAILED", "Server-to-server authentication with the AI service failed");
    }
    // 503 (e.g. AI_RATE_LIMITED, AI_NOT_CONFIGURED) stays 503 so the UI can say "try again later".
    // Other 4xx (413/415/422 bad upload) pass through; other 5xx become 502.
    const status = res.status === 503 || (res.status >= 400 && res.status < 500) ? res.status : 502;
    throw new AiServiceError(status, code, e?.message ?? `AI service returned ${res.status}`);
  }
  if (data === null) throw new AiServiceError(502, "AI_SERVICE_BAD_RESPONSE", "AI service returned invalid JSON");
  return data;
}
