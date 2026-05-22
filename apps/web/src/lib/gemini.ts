/** Gemini API — generates structured (JSON) responses. */
import { GEMINI_CAP_ERROR, geminiOverCap, recordGemini } from "./usage";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.5-flash";

/**
 * Generates a JSON result from a prompt plus a response schema.
 * schema is Gemini's responseSchema (OpenAPI subset, types in uppercase).
 *
 * Every call counts against a global daily cap (see lib/usage) — once it is
 * exhausted this throws GEMINI_CAP_ERROR so cost can't run away on launch day.
 * Whitelisted users pass `bypassCap` to skip that ceiling.
 */
export async function geminiJson<T>(
  prompt: string,
  schema: object,
  opts?: { bypassCap?: boolean },
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  if (!opts?.bypassCap && (await geminiOverCap())) throw new Error(GEMINI_CAP_ERROR);
  await recordGemini();

  const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${key}`, {
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
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다");
  return JSON.parse(text) as T;
}
