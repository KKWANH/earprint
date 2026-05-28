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
 * Sentinel thrown when Gemini rejects the call because the END USER (or
 * the Worker's outbound IP) is in a country the API isn't enabled for —
 * the message body looks like:
 *
 *   { "error": { "code": 400, "status": "FAILED_PRECONDITION",
 *     "message": "User location is not supported for the API use." }}
 *
 * Underlying fix is GCP-side: enable billing on the specific project
 * that owns the API key (paid tier covers ~100 more countries than free,
 * including KR). geminiJson tries a lighter fallback model before
 * throwing this — see REGION_FALLBACK_MODEL.
 */
export const GEMINI_REGION_ERROR = "GEMINI_REGION_UNSUPPORTED";

/**
 * Default model — used by callers that don't pass an override.
 * Bumped from gemini-2.0-flash → gemini-2.5-flash (R25b, 2026-05-29)
 * because Google deprecated the 2.0 line for *new* API keys; existing
 * keys retained access, but a freshly-issued key returns 404 NOT_FOUND
 * for the 2.0 models. The 2.5 line is API-compatible (same request
 * shape, same JSON-mode behaviour) so this is a drop-in bump.
 * The music-psychology profile still bumps to `gemini-2.5-pro` via
 * the `model` argument for that single high-value generation
 * (~$0.014 vs ~$0.0007 per call).
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/**
 * Fallback model used when the primary call returns the region-
 * restriction 400. `gemini-2.5-flash-lite` has the widest country
 * coverage on the free tier — when billing hasn't propagated to the
 * project yet (or the user happens to live somewhere a heavier model
 * isn't yet enabled), at least flash-lite usually works. Output quality
 * drops vs. 2.5-pro but the user gets a result instead of a 400.
 *
 * Only used if the primary `model` wasn't already this — otherwise we
 * just throw GEMINI_REGION_ERROR for the UI to surface.
 */
const REGION_FALLBACK_MODEL =
  process.env.GEMINI_REGION_FALLBACK ?? "gemini-2.5-flash-lite";

/** Inner fetch — one call to one model. Surfaces region errors as the
 *  sentinel + cost-tracks success-only. */
async function callModel<T>(
  key: string,
  model: string,
  prompt: string,
  schema: object,
): Promise<T> {
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
    if (
      res.status === 400 &&
      /User location is not supported|FAILED_PRECONDITION/i.test(body)
    ) {
      throw new Error(GEMINI_REGION_ERROR);
    }
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다");
  return JSON.parse(text) as T;
}

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
 * Region resilience: if the primary call returns the "User location is
 * not supported" 400, geminiJson retries ONCE with REGION_FALLBACK_MODEL
 * (defaults to gemini-2.0-flash-lite, broadest country coverage). Only
 * if both fail does the GEMINI_REGION_ERROR sentinel propagate to the
 * caller for UI surfacing + credit refund.
 *
 * Counters are incremented ONLY after a successful response so a network
 * error / 4xx / 5xx doesn't burn a user's credit.
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

  const primaryModel = opts?.model ?? DEFAULT_MODEL;
  // Audit fix (May 2026): count BOTH calls when the region failover
  // kicks in. The previous code only recorded once at the end, so a
  // fallover-succeeded request charged the user for 1 call but actually
  // burned 2 against Google's quota (the primary's 400 still counts on
  // some plans, and our internal cap also undercounted). We now record
  // after each successful callModel — failed calls don't record.
  let result: T;
  try {
    result = await callModel<T>(key, primaryModel, prompt, schema);
    await recordGemini();
    if (opts?.userId) await recordGeminiForUser(opts.userId);
  } catch (e) {
    if (
      String(e).includes(GEMINI_REGION_ERROR) &&
      primaryModel !== REGION_FALLBACK_MODEL
    ) {
      // The primary 400'd before producing tokens, so we don't record
      // it. Try the fallback model; if THAT succeeds, count that one.
      result = await callModel<T>(key, REGION_FALLBACK_MODEL, prompt, schema);
      await recordGemini();
      if (opts?.userId) await recordGeminiForUser(opts.userId);
    } else {
      throw e;
    }
  }
  return result;
}
