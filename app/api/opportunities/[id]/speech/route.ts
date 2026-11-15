import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/database/db";
import { OPPORTUNITY_COLUMNS } from "@/lib/database/columns";
import { requireUser } from "@/lib/auth";
import { apiError, handleError, readJson } from "@/lib/api";
import { UUID_RE, isObject } from "@/lib/validation";
import { speechScript, type SpeakableListing } from "@/lib/speech";

type Ctx = { params: Promise<{ id: string }> };

// Best-effort, per server instance: a small audio cache and a per-student hourly limit,
// so a demo cannot burn through the ElevenLabs quota.
const cache = new Map<string, ArrayBuffer>();
const recent = new Map<string, number[]>();
const PER_HOUR = 30;

// POST /api/opportunities/{id}/speech — { slow?: boolean } → audio/mpeg of the listing's read-aloud script.
// The script is built by fixed rules (lib/speech.ts); ElevenLabs only voices it.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return apiError(503, "TTS_NOT_CONFIGURED", "Read-aloud is not set up on this server");
    const { id } = await params;
    if (!UUID_RE.test(id)) return apiError(400, "INVALID_INPUT", "id must be a UUID", "id");
    const body = await readJson(req).catch(() => ({}));
    const slow = isObject(body) && body.slow === true;

    const now = Date.now();
    const mine = (recent.get(auth.userId) ?? []).filter((t) => now - t < 3_600_000);
    if (mine.length >= PER_HOUR) return apiError(429, "RATE_LIMITED", "Too many read-aloud requests this hour");

    const rows = await getSql().query(`SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities o WHERE o.opportunity_id = $1`, [id]);
    if (!rows[0]) return apiError(404, "NOT_FOUND", "Opportunity not found");
    const text = speechScript(rows[0] as SpeakableListing);

    const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
    const model = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
    const cacheKey = createHash("sha256").update(`${voice}|${model}|${slow}|${text}`).digest("hex");
    let audio = cache.get(cacheKey);
    if (!audio) {
      mine.push(now);
      recent.set(auth.userId, mine);
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: slow ? 0.8 : 1.0 },
          }),
          signal: AbortSignal.timeout(30_000),
          cache: "no-store",
        },
      );
      if (!res.ok) {
        console.error(JSON.stringify({ event: "tts_failed", status: res.status }));
        return apiError(502, "TTS_FAILED", "The voice service could not read this listing right now");
      }
      audio = await res.arrayBuffer();
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, audio);
    }
    return new Response(audio, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600", "x-speech-chars": String(text.length) },
    });
  } catch (err) {
    return handleError("POST /api/opportunities/[id]/speech", err);
  }
}
