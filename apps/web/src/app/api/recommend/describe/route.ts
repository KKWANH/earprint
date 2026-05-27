import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { captureError } from "@/lib/sentry";
import { aiJson, sanitizeAiString } from "@/lib/ai";
import { z } from "zod";

/**
 * Lazy "why this song matters" generator. Called from the Tournament
 * card on mount when `description` is null, so descriptions only get
 * generated for songs the user actually sees — not the whole batch of
 * 20 recs that mostly get scrolled past.
 *
 * Caches in `recommendations.blurb` so each rec only pays the Gemini
 * cost once per user. The cap counter (lib/usage) shares with profile
 * + analyze, so a runaway here can't burn budget independently.
 *
 * Output is 1–2 short sentences in the user's locale.
 */

const RESP = {
  type: "OBJECT",
  properties: {
    en: { type: "STRING" },
    ko: { type: "STRING" },
  },
  required: ["en", "ko"],
};

const RespZ = z.object({
  en: z.string().max(400).transform(sanitizeAiString),
  ko: z.string().max(400).transform(sanitizeAiString),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const bodyParse = await readJsonBody<{ id?: string }>(req, 1024);
  if (!bodyParse.ok) return bodyParse.response;
  const body = bodyParse.data;
  const id = (body.id ?? "").trim();
  if (!id) return json({ error: "id required" }, 400);

  const sql = getSql();
  // Read the row first; we need the artist+title for the prompt and
  // we don't want to regenerate an already-cached blurb.
  const rows = await sql`
    SELECT artist, title, blurb
    FROM recommendations
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
  if (rows.length === 0) return json({ error: "not found" }, 404);
  const r = rows[0]!;
  if (r.blurb) {
    return json({ description: r.blurb as string, cached: true }, 200);
  }

  const artist = r.artist as string;
  const title = r.title as string;
  const prompt =
    `곡 "${title}" — ${artist} 에 대해 짧고 정확한 소개를 작성하세요. ` +
    `이 곡의 발매·아티스트 배경·왜 들어볼 만한지(스타일·영향·평가) 를 1~2문장으로 정확하게. ` +
    `과장·홍보문구·존재하지 않는 사실 금지. 정말 모르는 곡이면 영문/한국어 모두 빈 문자열. ` +
    `en 필드는 영어로, ko 필드는 자연스러운 한국어로.`;

  let parsed: { en: string; ko: string };
  try {
    const raw = await aiJson<unknown>(prompt, RESP, { userId });
    const v = RespZ.safeParse(raw);
    if (!v.success) return json({ description: null, error: "schema" }, 200);
    parsed = v.data;
  } catch (e) {
    // Gemini cap or transient error — return null so the card hides
    // the description block. We don't cache the failure: next visit
    // tries again (rare enough that polling cost is negligible).
    captureError(e, { tag: "recommend.describe" });
    return json({ description: null }, 200);
  }

  const description = (parsed.ko?.trim() || parsed.en?.trim() || "") || null;
  if (description) {
    try {
      await sql`
        UPDATE recommendations SET blurb = ${description}
        WHERE id = ${id}::uuid AND blurb IS NULL`;
    } catch {
      /* cache write is best-effort */
    }
  }
  // Return both languages so the client can render whichever matches
  // the active locale. UI prefers ko when locale=ko, en otherwise.
  return json(
    { description, en: parsed.en ?? null, ko: parsed.ko ?? null },
    200,
  );
}
