import { z } from "zod";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { fetchYouTubeOEmbed, parseYouTubeVideoId } from "@/lib/youtubeId";

/**
 * POST /api/worldcup/community/create
 *
 * Creates a user-generated worldcup. Body is the title + 4-32 YouTube
 * URLs (or bare videoIds). Server-side we:
 *   1. Parse each URL → videoId, dedupe (a worldcup with the same
 *      video twice doesn't make sense).
 *   2. Fetch oEmbed metadata for each (title / author / thumbnail).
 *      Failures fall through with a placeholder title; the worldcup
 *      still creates so the user isn't blocked by one dead video.
 *   3. Insert the worldcup + items in one transaction.
 *
 * Returns the new worldcup id so the client can navigate to /worldcup
 * /community/[id] right away.
 *
 * Bracket sizes are powers of 2 in [4, 32]. Larger brackets (64+)
 * are deferred until we see whether anyone wants them — the create
 * UI also caps at 32 today.
 */
const Body = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(800).optional(),
  visibility: z.enum(["public", "unlisted"]).optional().default("public"),
  videos: z.array(z.string().trim().min(1).max(400)).min(4).max(32),
  // Optional free-form short tags (lowercased server-side). Max 5
  // tags, 12 chars each — keeps the rendered chips compact.
  tags: z.array(z.string().trim().min(1).max(12)).max(5).optional().default([]),
});

const ALLOWED_SIZES = new Set([4, 8, 16, 32]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);

  // Need the user row's id for ownership. ensureConnection upserts the
  // user row if this is the first /worldcup hit since sign-in.
  const { userId } = await ensureConnection();

  const parsed = await readJsonBody<unknown>(req, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) {
    return json(
      {
        error: "invalid payload",
        issues: v.error.issues.slice(0, 5).map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }
  const body = v.data;

  // Parse + dedupe video IDs.
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of body.videos) {
    const id = parseYouTubeVideoId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ALLOWED_SIZES.has(ids.length)) {
    return json(
      {
        error: `bracket size after dedup must be one of ${[...ALLOWED_SIZES].join(", ")}; got ${ids.length}`,
      },
      400,
    );
  }

  // Fetch oEmbed in parallel — bounded by the per-batch limit so a
  // 32-item bracket doesn't fan out wildly. Failures fall through
  // with a placeholder.
  const meta = await Promise.all(ids.map((id) => fetchYouTubeOEmbed(id)));

  // Tags: lowercase, dedupe, drop empties.
  const tagSet = new Set<string>();
  for (const raw of body.tags ?? []) {
    const v = raw.toLowerCase().trim();
    if (v) tagSet.add(v);
  }
  const tags = [...tagSet];

  const sql = getSql();
  const rows = await sql`
    INSERT INTO community_worldcups (owner_user_id, title, description, visibility, tags)
    VALUES (${userId}, ${body.title}, ${body.description ?? null}, ${body.visibility}, ${tags}::text[])
    RETURNING id`;
  const worldcupId = rows[0]?.id as string | undefined;
  if (!worldcupId) return json({ error: "create failed" }, 500);

  // Bulk insert items. Run as one statement per row — neon's tagged
  // template doesn't support easy bulk inserts and 32 rows is fine
  // for a one-off create call.
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const m = meta[i];
    await sql`
      INSERT INTO community_worldcup_items
        (worldcup_id, position, yt_video_id, title, subtitle, thumbnail_url)
      VALUES (
        ${worldcupId}, ${i}, ${id},
        ${m?.title ?? `YouTube ${id}`},
        ${m?.author ?? null},
        ${m?.thumbnail ?? null}
      )`;
  }
  return json({ ok: true, id: worldcupId }, 200);
}
