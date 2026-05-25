/**
 * AI dispatcher — single provider (Gemini). Earlier this file fanned out
 * to a parallel Gemini+Kimi race, but Moonshot (Kimi) is China-based and
 * sending EU user data there without a valid GDPR transfer mechanism was
 * a compliance risk we couldn't ergonomically solve at this scale.
 *
 * Kept as its own module so callers don't need to know the underlying
 * provider — future swaps stay local to this file.
 */
import { geminiJson } from "./gemini";

export async function aiJson<T>(
  prompt: string,
  schema: object,
  opts?: { bypassCap?: boolean; model?: string },
): Promise<T> {
  return geminiJson<T>(prompt, schema, opts);
}
