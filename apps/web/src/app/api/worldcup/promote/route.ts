import { z } from "zod";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * POST /api/worldcup/promote
 *
 * Promote a built-in / curated bracket into a community worldcup the
 * whole world can play. The client passes the title + the candidate
 * list it was running locally; we resolve a YouTube videoId for each
 * candidate (via the existing yt-search cache hot-path; never burns
 * the daily quota unless the cache misses), then insert into
 * community_worldcups + community_worldcup_items just like the
 * normal /create endpoint.
 *
 * Returns the new worldcup id so the client can redirect to
 * /worldcup/community/[id].
 *
 * Sizes accepted: 4 / 8 / 16 / 32 — same constraint as the create
 * endpoint. Re-using the same upper bound keeps the public list
 * uniform; bigger built-in brackets (64 / 128 / 256) get truncated
 * to the top 32 by score before promotion.
 */
const Candidate = z.object({
  id: z.string().min(1),
  artist: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  coverUrl: z.string().trim().max(500).optional().nullable(),
  ytVideoId: z.string().trim().max(64).optional().nullable(),
});

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(800).optional(),
  visibility: z.enum(["public", "unlisted"]).optional().default("public"),
  tags: z.array(z.string().trim().min(1).max(12)).max(5).optional().default([]),
  candidates: z.array(Candidate).min(4).max(64),
});

// R34 — matches create endpoint + create form (128/256 added).
const ALLOWED_SIZES = new Set([4, 8, 16, 32, 64, 128, 256]);
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Resolve videoId for a candidate. If the caller already passed
 * a valid 11-char ytVideoId, trust it. Otherwise hit the existing
 * yt-search cache via SQL directly (avoids round-tripping through
 * /api/recommend/yt-search and burning a budget).
 */
async function resolveVideoId(
  sql: ReturnType<typeof import("@/lib/db").getSql>,
  c: z.infer<typeof Candidate>,
): Promise<string | null> {
  if (c.ytVideoId && VIDEO_ID_RE.test(c.ytVideoId)) return c.ytVideoId;
  const key = `${c.artist.toLowerCase().trim()}|${c.title.toLowerCase().trim()}`;
  const rows = await sql`
    SELECT video_id FROM yt_search_cache WHERE cache_key = ${key} LIMIT 1`;
  const cached = rows[0]?.video_id as string | null | undefined;
  if (cached && VIDEO_ID_RE.test(cached)) return cached;
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const parsed = await readJsonBody<unknown>(req, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  const body = v.data;

  const sql = getSql();

  // Resolve a videoId for each candidate. Truncate to the largest
  // allowed power-of-2 size ≤ candidates.length so the bracket
  // shape stays valid.
  const sizeTarget = (() => {
    for (const s of [256, 128, 64, 32, 16, 8, 4]) if (body.candidates.length >= s) return s;
    return 4;
  })();
  type Resolved = {
    id: string;
    artist: string;
    title: string;
    coverUrl: string | null;
    videoId: string;
  };
  const resolved: Resolved[] = [];
  for (const c of body.candidates) {
    if (resolved.length === sizeTarget) break;
    const vid = await resolveVideoId(sql, c);
    if (!vid) continue;
    resolved.push({
      id: c.id,
      artist: c.artist,
      title: c.title,
      coverUrl: c.coverUrl ?? null,
      videoId: vid,
    });
  }
  if (!ALLOWED_SIZES.has(resolved.length)) {
    return json(
      {
        error: `couldn't resolve enough YT videos (got ${resolved.length} of ${sizeTarget}). Try again with a smaller bracket or different candidates.`,
      },
      400,
    );
  }

  // Tags: lowercase, dedup, drop empties (mirror /create endpoint).
  const tagSet = new Set<string>();
  for (const t of body.tags ?? []) {
    const lc = t.toLowerCase().trim();
    if (lc) tagSet.add(lc);
  }
  const tags = [...tagSet];

  // Insert worldcup + items. tags + thumbnail_url overrides land in
  // the same columns the /create endpoint writes to so the
  // downstream play/stats/embed flows are uniform.
  const wcRows = await sql`
    INSERT INTO community_worldcups (owner_user_id, title, description, visibility, tags)
    VALUES (${userId}, ${body.title}, ${body.description ?? null}, ${body.visibility}, ${tags}::text[])
    RETURNING id`;
  const worldcupId = wcRows[0]?.id as string | undefined;
  if (!worldcupId) return json({ error: "create failed" }, 500);

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]!;
    await sql`
      INSERT INTO community_worldcup_items
        (worldcup_id, position, yt_video_id, title, subtitle, thumbnail_url)
      VALUES (
        ${worldcupId}, ${i}, ${r.videoId},
        ${r.title}, ${r.artist}, ${r.coverUrl}
      )`;
  }

  return json({ ok: true, id: worldcupId, promoted: resolved.length }, 200);
}
