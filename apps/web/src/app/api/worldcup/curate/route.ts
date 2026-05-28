import { z } from "zod";
import { aiJson } from "@/lib/ai";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * POST /api/worldcup/curate
 *
 * Track A of the worldcup roadmap: AI-curated "favourites" lens.
 * The user picks a mood/lens ("all-time favourites", "sad songs",
 * "pump-up", "late-night", "recent obsessions", "forgotten",
 * custom prompt) and Gemini picks N tracks from their library that
 * best fit the lens.
 *
 * Why not just SQL: SQL can do "most recent" or "highest play
 * count" but it can't do "songs that feel like rainy afternoons"
 * or "songs I keep coming back to even when they're not new". The
 * model uses titles + artists + genre/mood tags to make those calls.
 *
 * Cost: ~$0.005 per call (Gemini flash-lite, 200-track input
 * fits comfortably in the context window). Free tier gets one
 * curated bracket per day; paid users effectively unlimited (no
 * separate gate beyond the per-Gemini cap).
 */
const Body = z.object({
  lens: z.string().trim().min(1).max(300),
  size: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
});

const CurateResponseZ = z.object({
  picks: z.array(z.number().int().min(0).max(199)).min(1).max(32),
});

const SCHEMA = {
  type: "OBJECT",
  properties: {
    picks: {
      type: "ARRAY",
      items: { type: "INTEGER" },
    },
  },
  required: ["picks"],
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const parsed = await readJsonBody<unknown>(req, 8 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  const { lens, size } = v.data;

  // Pull up to 200 candidates from the user's library, weighted by
  // recency so the prompt context favours current taste. We also
  // include any analysed genres + moods so the model can reason
  // about feel ("sad songs" matches mood='melancholic' etc.).
  const sql = getSql();
  const rows = (await sql`
    WITH lib_size AS (
      SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
    )
    SELECT t.id, t.artist, t.title, t.release_year, t.deezer_id, t.preview_url,
           a.genres, a.moods
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
    CROSS JOIN lib_size
    WHERE ut.user_id = ${userId}
      AND (NOT t.resolved OR t.match_confidence >= 0.65)
    ORDER BY recency_weight(ut.list_position, lib_size.n) DESC, random()
    LIMIT 200`) as Array<{
    id: string;
    artist: string;
    title: string;
    release_year: number | null;
    deezer_id: number | null;
    preview_url: string | null;
    genres: Record<string, number> | null;
    moods: Record<string, number> | null;
  }>;

  if (rows.length < size) {
    return json(
      {
        error: `not enough tracks (have ${rows.length}, need ${size}). Sync more songs or pick a smaller bracket.`,
      },
      400,
    );
  }

  // Build the numbered input list for the model. Keep each line
  // short — 200 lines fits in the prompt comfortably but we don't
  // want to pump full jsonb dumps in.
  const numbered = rows
    .map((r, i) => {
      const g = r.genres ? Object.keys(r.genres).slice(0, 3).join("/") : "";
      const m = r.moods ? Object.keys(r.moods).slice(0, 2).join("/") : "";
      const tags = [g, m].filter(Boolean).join(" · ");
      return `[${i}] ${r.artist} — ${r.title}${tags ? `  (${tags})` : ""}`;
    })
    .join("\n");

  const prompt = `You are curating a music-tournament bracket from a single user's
library. From the numbered list below, pick exactly ${size}
tracks that best fit this lens: "${lens}"

Rules:
- Output ONLY the indexes (the bracketed integers). No prose.
- Choose ${size} distinct indexes from 0..${rows.length - 1}.
- Favor variety within the lens (don't pick 10 songs by the same artist).
- If the lens is "all-time favourites" / "내 최애" type, lean toward
  high-recency + variety. If it's mood-based ("sad", "pump-up",
  "late-night", "rainy"), use the (genre/mood) tags + your music
  knowledge of the title/artist pairs.
- If the user's lens is in Korean, that's fine — interpret it
  semantically. The output is still just indexes.

${numbered}`;

  const model = process.env.GEMINI_MODEL_CURATE ?? "gemini-2.0-flash-lite";
  let raw: unknown;
  try {
    raw = await aiJson<unknown>(prompt, SCHEMA, { model, userId });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
  const parsedRes = CurateResponseZ.safeParse(raw);
  if (!parsedRes.success) {
    return json({ error: "model response invalid" }, 502);
  }
  // Dedup + clamp + enforce size. If the model returns < size unique
  // indices we top up with the highest-weighted rows that aren't
  // already picked.
  const seen = new Set<number>();
  const picks: number[] = [];
  for (const idx of parsedRes.data.picks) {
    if (idx >= 0 && idx < rows.length && !seen.has(idx)) {
      seen.add(idx);
      picks.push(idx);
      if (picks.length === size) break;
    }
  }
  for (let i = 0; i < rows.length && picks.length < size; i++) {
    if (!seen.has(i)) {
      picks.push(i);
      seen.add(i);
    }
  }

  const candidates = picks.map((i, pos) => {
    const r = rows[i]!;
    return {
      id: r.id,
      artist: r.artist,
      title: r.title,
      coverUrl: null as string | null,
      deezerId: r.deezer_id,
      score: rows.length - pos, // descending so the bracket order respects the model's preference
      recType: "lens",
      // Tracks already in the library — we know they have a Deezer
      // preview url cached; preview button on BracketCard reads
      // /api/preview which fetches a fresh signed url for the
      // deezerId on demand.
    };
  });

  return json({ ok: true, lens, size, candidates }, 200);
}
