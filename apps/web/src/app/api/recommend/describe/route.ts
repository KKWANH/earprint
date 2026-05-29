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

  // R28j — global cache by canonical key. The same song surfaced as
  // a different recommendation row (same user re-roll, or another
  // user landing on the same track) reuses the cached blurb here,
  // so Gemini cost amortizes across the platform instead of being
  // per-recommendation-row. Lookup is cheap; failure falls through
  // to a fresh Gemini call without surfacing.
  try {
    const cached = await sql`
      SELECT description_en, description_ko
      FROM track_blurbs
      WHERE canon_key = track_canon_key(${artist}, ${title})
      LIMIT 1`;
    if (cached.length > 0) {
      const en = (cached[0]?.description_en as string | null) ?? null;
      const ko = (cached[0]?.description_ko as string | null) ?? null;
      const description = (ko?.trim() || en?.trim() || "") || null;
      if (description) {
        // Copy into per-row cache so the next click on this same
        // recommendation is one-query fast (and we never re-pay
        // the canon_key join cost).
        await sql`
          UPDATE recommendations SET blurb = ${description}
          WHERE id = ${id}::uuid AND blurb IS NULL`;
        return json({ description, en, ko, cached: true }, 200);
      }
    }
  } catch {
    /* track_blurbs missing (pre-R28j migration) — fall through */
  }

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
    // Two cases the UI cares about (so we surface a reason key it can
    // act on instead of a generic null):
    //   cap   → user's daily Gemini quota or our global budget is out.
    //           Card should keep working without the blurb and not
    //           refire on every scroll.
    //   error → transient / network / region — same UX, but tagged
    //           differently so analytics can spot persistent failures.
    const msg = String(e);
    const reason =
      msg.includes("GEMINI_DAILY_CAP") || msg.includes("GEMINI_REGION_UNSUPPORTED")
        ? "cap"
        : "error";
    captureError(e, { tag: "recommend.describe", extra: { reason } });
    return json({ description: null, reason }, 200);
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
    // R28j — also write to the global track_blurbs cache so future
    // recommendations of the same canonical track (different user,
    // different reroll) hit it without burning Gemini. Wrapped in
    // try/catch so pre-migration deploys still serve the per-row
    // path correctly.
    try {
      await sql`
        INSERT INTO track_blurbs
          (canon_key, description_en, description_ko)
        VALUES (
          track_canon_key(${artist}, ${title}),
          ${parsed.en?.trim() || null},
          ${parsed.ko?.trim() || null}
        )
        ON CONFLICT (canon_key) DO UPDATE
          SET description_en = COALESCE(track_blurbs.description_en, EXCLUDED.description_en),
              description_ko = COALESCE(track_blurbs.description_ko, EXCLUDED.description_ko),
              generated_at = now()`;
    } catch {
      /* track_blurbs missing — global cache disabled */
    }
  }
  // Return both languages so the client can render whichever matches
  // the active locale. UI prefers ko when locale=ko, en otherwise.
  return json(
    { description, en: parsed.en ?? null, ko: parsed.ko ?? null },
    200,
  );
}
