/** Gemini API — generates structured (JSON) responses. */
import {
  GEMINI_CAP_ERROR,
  geminiOverCap,
  geminiOverUserCap,
  recordGemini,
  recordGeminiForUser,
} from "./usage";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Default model — used by callers that don't pass an override. `gemini-2.0-flash`
 * is the cheap workhorse; the music-psychology profile bumps to `gemini-2.5-pro`
 * via the `model` argument because that single high-value generation is worth
 * the price difference (~$0.014 vs $0.0007 per call).
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

/**
 * Generates a JSON result from a prompt plus a response schema.
 * schema is Gemini's responseSchema (OpenAPI subset, types in uppercase).
 *
 * Cost guards (in order):
 *   1. Per-user daily cap (when `userId` is passed) — prevents a single
 *      authenticated user from draining the global budget themselves.
 *   2. Global daily cap — prevents a viral launch from running cost away.
 * Whitelisted users pass `bypassCap` to skip BOTH ceilings.
 *
 * Counters are incremented ONLY after a successful response from Gemini
 * so a network error / 4xx / 5xx doesn't burn a user's credit — the
 * earlier implementation recorded before the call and the failure mode
 * was unfair to paying users.
 */
export async function geminiJson<T>(
  prompt: string,
  schema: object,
  opts?: { bypassCap?: boolean; model?: string; userId?: string },
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  if (!opts?.bypassCap) {
    if (opts?.userId && (await geminiOverUserCap(opts.userId))) {
      throw new Error(GEMINI_CAP_ERROR);
    }
    if (await geminiOverCap()) throw new Error(GEMINI_CAP_ERROR);
  }

  const model = opts?.model ?? DEFAULT_MODEL;
  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.85,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다");

  // Success path — only NOW do we charge against the daily counters.
  // Failure paths above all throw before reaching here, so the user
  // never pays for a request that didn't return useful content.
  await recordGemini();
  if (opts?.userId) await recordGeminiForUser(opts.userId);

  return JSON.parse(text) as T;
}
