import { z } from "zod";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * GET /api/worldcup/community/recent?before=<iso>&beforeId=<uuid>&limit=<n>
 *
 * Cursor-paginated feed of recent community worldcup finishes.
 * Powers the infinite scroll on /worldcup/community/recent.
 *
 * R38 (EC-1) — composite cursor (finished_at, id). The old
 * single-column `before` cursor could skip or duplicate rows when
 * two finishes shared the exact same finished_at across a page
 * boundary. Now the tiebreak on the (random) id gives a stable
 * total order so every row is returned exactly once. id ordering
 * is arbitrary but deterministic, which is all pagination needs.
 *
 * Anonymous-friendly. Hard cap on limit.
 */
const QueryZ = z.object({
  before: z.string().datetime().optional(),
  beforeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

interface Row {
  id: string;
  finished_at: string;
  champion_title: string;
  champion_subtitle: string | null;
  thumbnail_url: string | null;
  worldcup_id: string;
  worldcup_title: string;
  owner_email: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QueryZ.safeParse({
    before: url.searchParams.get("before") ?? undefined,
    beforeId: url.searchParams.get("beforeId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return json({ error: "bad query" }, 400);
  const { before, beforeId, limit } = parsed.data;

  const sql = getSql();
  try {
    // Two query shapes: with a composite cursor vs the first page.
    // The cursor predicate (finished_at, id) < (before, beforeId)
    // is expressed explicitly since neon's tagged template doesn't
    // take a row-value comparison cleanly.
    const rows = (
      before && beforeId
        ? await sql`
            SELECT f.id::text AS id, f.finished_at,
                   i.title AS champion_title, i.subtitle AS champion_subtitle,
                   i.thumbnail_url AS thumbnail_url,
                   w.id::text AS worldcup_id, w.title AS worldcup_title,
                   u.email AS owner_email
            FROM community_worldcup_finishes f
            JOIN community_worldcup_items i ON i.id = f.champion_item_id
            JOIN community_worldcups w ON w.id = f.worldcup_id
            LEFT JOIN users u ON u.id = w.owner_user_id
            WHERE w.visibility = 'public'
              AND (
                f.finished_at < ${before}::timestamptz
                OR (f.finished_at = ${before}::timestamptz AND f.id < ${beforeId}::uuid)
              )
            ORDER BY f.finished_at DESC, f.id DESC
            LIMIT ${limit}`
        : await sql`
            SELECT f.id::text AS id, f.finished_at,
                   i.title AS champion_title, i.subtitle AS champion_subtitle,
                   i.thumbnail_url AS thumbnail_url,
                   w.id::text AS worldcup_id, w.title AS worldcup_title,
                   u.email AS owner_email
            FROM community_worldcup_finishes f
            JOIN community_worldcup_items i ON i.id = f.champion_item_id
            JOIN community_worldcups w ON w.id = f.worldcup_id
            LEFT JOIN users u ON u.id = w.owner_user_id
            WHERE w.visibility = 'public'
            ORDER BY f.finished_at DESC, f.id DESC
            LIMIT ${limit}`
    ) as unknown as Row[];

    const items = rows.map((r) => ({
      id: r.id,
      finishedAt: new Date(r.finished_at).toISOString(),
      championTitle: r.champion_title,
      championSubtitle: r.champion_subtitle ?? null,
      thumbnailUrl: r.thumbnail_url ?? null,
      worldcupId: r.worldcup_id,
      worldcupTitle: r.worldcup_title,
      ownerHandle: r.owner_email?.split("@")[0]?.toLowerCase() ?? null,
    }));
    const last = items[items.length - 1];
    return json(
      {
        ok: true,
        items,
        nextBefore: items.length === limit ? last?.finishedAt : null,
        nextBeforeId: items.length === limit ? last?.id : null,
      },
      200,
    );
  } catch {
    return json({ ok: true, items: [], nextBefore: null, nextBeforeId: null }, 200);
  }
}
