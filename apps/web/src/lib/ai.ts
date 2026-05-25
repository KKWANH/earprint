/**
 * AI provider dispatcher. Routes structured-JSON requests between Gemini
 * and Kimi according to AI_MODE env:
 *
 *   race    (default) — fire both, first valid response wins. ~50% latency
 *                       reduction + survives one provider being down. Costs
 *                       ~2× because both calls bill.
 *   split             — random 50/50 per request. Halves Gemini quota
 *                       pressure; total $ goes up because Kimi is dearer
 *                       per token.
 *   gemini            — Gemini only (original behaviour).
 *   kimi              — Kimi only.
 *
 * Whichever mode runs, the Gemini-side daily cap still applies to any
 * Gemini call so cost can't run away on launch day. Kimi calls are not
 * capped here — Moonshot enforces their own per-key limit.
 */
import { geminiJson } from "./gemini";
import { kimiJson } from "./kimi";

type AiMode = "race" | "split" | "gemini" | "kimi";

function aiMode(): AiMode {
  const m = process.env.AI_MODE;
  if (m === "race" || m === "split" || m === "gemini" || m === "kimi") return m;
  // Default to race when both keys are present, gemini-only otherwise.
  return process.env.KIMI_API_KEY ? "race" : "gemini";
}

export async function aiJson<T>(
  prompt: string,
  schema: object,
  opts?: { bypassCap?: boolean },
): Promise<T> {
  const mode = aiMode();
  const hasKimi = !!process.env.KIMI_API_KEY;

  // Fall through to Gemini-only when Kimi key isn't configured, regardless
  // of the requested mode — avoids "KIMI_API_KEY is not set" exceptions on
  // a half-set deployment.
  if (mode === "gemini" || !hasKimi) {
    return geminiJson<T>(prompt, schema, opts);
  }
  if (mode === "kimi") {
    return kimiJson<T>(prompt, schema);
  }
  if (mode === "split") {
    return Math.random() < 0.5
      ? geminiJson<T>(prompt, schema, opts)
      : kimiJson<T>(prompt, schema);
  }

  // mode === "race": fire both in parallel; the first promise to resolve
  // wins. Promise.any swallows individual rejections — if one provider
  // 4xx/5xxs, the other's response is still returned. If BOTH fail,
  // Promise.any throws AggregateError; we surface the first underlying
  // error so existing GEMINI_CAP_ERROR handlers in callers still match.
  try {
    return await Promise.any([
      geminiJson<T>(prompt, schema, opts),
      kimiJson<T>(prompt, schema),
    ]);
  } catch (e) {
    if (e instanceof AggregateError) throw e.errors[0];
    throw e;
  }
}
