/**
 * Moonshot (Kimi) — OpenAI-compatible JSON output.
 *
 * Moonshot's API mirrors OpenAI Chat Completions but only supports
 * `response_format: { type: "json_object" }`, not strict json_schema. The
 * shape is enforced by embedding the schema in the prompt and validating
 * after parse (callers can re-check fields if they care).
 *
 * Pricing note: Kimi is currently 5–8× the cost-per-token of Gemini Flash,
 * so this provider is mostly useful as a parallel/fallback path for
 * reliability, not as a cost-saver.
 */

const MOONSHOT_ENDPOINT = "https://api.moonshot.ai/v1/chat/completions";

/**
 * Default Moonshot model. moonshot-v1-8k is the cheapest tier; bump to
 * `-32k` / `-128k` only if prompts grow past ~6K tokens.
 */
const MODEL = process.env.KIMI_MODEL ?? "moonshot-v1-8k";

/**
 * Gemini's schema format uses uppercase types ("OBJECT", "STRING", "ARRAY").
 * OpenAI / Moonshot want lowercase JSON Schema. This walks the tree and
 * rewrites types so callers can keep one schema definition.
 */
function geminiSchemaToJsonSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(geminiSchemaToJsonSchema);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "type" && typeof v === "string") {
      out[k] = v.toLowerCase();
    } else {
      out[k] = geminiSchemaToJsonSchema(v);
    }
  }
  return out;
}

/**
 * Generates a JSON result from a Moonshot model. Same call signature as
 * `geminiJson` so the dispatcher can substitute one for the other.
 */
export async function kimiJson<T>(prompt: string, schema: object): Promise<T> {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error("KIMI_API_KEY is not set");

  // Inline the schema into the prompt — Moonshot doesn't validate against a
  // json_schema, so the model needs to see it.
  const schemaJs = geminiSchemaToJsonSchema(schema);
  const fullPrompt =
    `${prompt}\n\n` +
    `Respond with ONLY a JSON object matching this schema (no prose, no markdown):\n` +
    `${JSON.stringify(schemaJs, null, 2)}`;

  const res = await fetch(MOONSHOT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.85,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kimi ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Kimi 응답이 비어 있습니다");
  return JSON.parse(text) as T;
}
