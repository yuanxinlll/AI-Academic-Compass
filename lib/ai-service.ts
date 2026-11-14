import { AiServiceError } from "@/lib/api";

// Client for B's stateless Python service — docs/contracts.md §8.
// Server-side only: INTERNAL_TOKEN must never reach the browser.
export async function callAiService(
  path: "/internal/match" | "/internal/resume/parse",
  body: FormData | object,
  timeoutMs = 30_000,
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

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    // 4xx from B = bad input we forwarded → pass through; 5xx → 502 to our caller.
    throw new AiServiceError(
      res.status >= 500 ? 502 : res.status,
      e?.code ?? "AI_SERVICE_ERROR",
      e?.message ?? `AI service returned ${res.status}`,
    );
  }
  if (data === null) throw new AiServiceError(502, "AI_SERVICE_BAD_RESPONSE", "AI service returned invalid JSON");
  return data;
}
