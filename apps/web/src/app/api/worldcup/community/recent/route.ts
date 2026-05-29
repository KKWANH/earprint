import { z } from "zod";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * GET /api/worldcup/community/recent?before=<iso>&limit=<n>
 *
 * Cursor-paginated feed of recent community worldcup finishes.
 * Powers the infinite scroll on /worldcup/community/recent (R35).
 *
 * Cursor = `before` (ISO datetime). Returns finishes strictly
 * older than that. Sort = finished_at DESC. Anonymous-friendly,
 * no auth gate (the parent page is public).
 *
 * Hard cap on limit so a crafted call can't dump the whole table.
 */
const QueryZ = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QueryZ.safeParse({
    before: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return json({ error: "bad query" }, 400);
  const { before, limit } = parsed.data;

  const sql = getSql();
  try {
    const rows = before
      ? await sql`
          SELECT f.finished_at,
                 i.title AS champion_title,
                 i.subtitle AS champion_subtitle,
                 i.thumbnail_url AS thumbnail_url,
                 w.id::text AS worldcup_id,
                 w.title AS worldcup_title,
                 u.email AS owner_email
          FROM community_worldcup_finishes f
          JOIN community_worldcup_items i ON i.id = f.champion_item_id
          JOIN community_worldcups w ON w.id = f.worldcup_id
          LEFT JOIN users u ON u.id = w.owner_user_id
          WHERE w.visibility = 'public'
            AND f.finished_at < ${before}::timestamptz
          ORDER BY f.finished_at DESC
          LIMIT ${limit}`
      : await sql`
          SELECT f.finished_at,
                 i.title AS champion_title,
                 i.subtitle AS champion_subtitle,
                 i.thumbnail_url AS thumbnail_url,
                 w.id::text AS worldcup_id,
                 w.title AS worldcup_title,
                 u.email AS owner_email
          FROM community_worldcup_finishes f
          JOIN community_worldcup_items i ON i.id = f.champion_item_id
          JOIN community_worldcups w ON w.id = f.worldcup_id
          LEFT JOIN users u ON u.id = w.owner_user_id
          WHERE w.visibility = 'public'
          ORDER BY f.finished_at DESC
          LIMIT ${limit}`;
    const items = rows.map((r) => ({
      finishedAt: new Date(r.finished_at as string).toISOString(),
      championTitle: r.champion_title as string,
      championSubtitle: (r.champion_subtitle as string | null) ?? null,
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      worldcupId: r.worldcup_id as string,
      worldcupTitle: r.worldcup_title as string,
      ownerHandle:
        (r.owner_email as string | null)?.split("@")[0]?.toLowerCase() ?? null,
    }));
    return json(
      {
        ok: true,
        items,
        // nextBefore the client passes back in to fetch the next
        // page. null when we hit the end (rows.length < limit).
        nextBefore:
          items.length === limit ? items[items.length - 1]?.finishedAt : null,
      },
      200,
    );
  } catch {
    return json({ ok: true, items: [], nextBefore: null }, 200);
  }
}
