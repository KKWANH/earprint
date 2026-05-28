import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * GET /api/worldcup/community/[id]/champion-social?itemId=<uuid>
 *
 * Returns a count of how many distinct Earprint users have this
 * champion item's YouTube video in their library. The social signal
 * for "you and N others liked this song" — privacy-preserving by
 * design (count only, no names, no PII).
 *
 * Anonymous-friendly: no auth gate. The numbers leak only the
 * platform-wide popularity of a specific YouTube video, which is the
 * same information the worldcup's play_count already broadcasts.
 *
 * Returns:
 *   { ok: true, otherFans: number } — count of distinct other users
 *                                     who have this in their library.
 * The number EXCLUDES the requesting user since we don't auth-gate
 * (would need a user_id we don't have). The UI labels it as "N
 * Earprint users" to match the actual semantics.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad id" }, 400);
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId || !/^[0-9a-f-]{36}$/i.test(itemId)) {
    return json({ error: "bad itemId" }, 400);
  }

  const sql = getSql();

  // Resolve the champion's videoId.
  let videoId: string;
  try {
    const rows = await sql`
      SELECT yt_video_id FROM community_worldcup_items
      WHERE id = ${itemId}::uuid AND worldcup_id = ${id}::uuid
      LIMIT 1`;
    if (rows.length === 0) return json({ error: "not found" }, 404);
    videoId = rows[0]!.yt_video_id as string;
  } catch {
    return json({ ok: true, otherFans: 0 }, 200);
  }

  // Count distinct users via track_sources(source='ytmusic',
  // source_id=videoId) JOIN user_tracks. This is the canonical match
  // since the YT Music extension stores videoIds as track_sources
  // entries; if our community video happens to be in someone's
  // library, this is how we find them.
  try {
    const rows = await sql`
      SELECT count(DISTINCT ut.user_id)::int AS n
      FROM track_sources ts
      JOIN user_tracks ut ON ut.track_id = ts.track_id
      WHERE ts.source = 'ytmusic' AND ts.source_id = ${videoId}`;
    const otherFans = Number((rows[0]?.n as number) ?? 0);
    return json({ ok: true, otherFans }, 200);
  } catch {
    return json({ ok: true, otherFans: 0 }, 200);
  }
}
