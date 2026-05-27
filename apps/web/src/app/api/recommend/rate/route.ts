import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

const VALID = new Set(["superlike", "like", "pass", "dislike", "strong_dislike", "known"]);

/**
 * Saves a recommendation rating — { id, rating, comment }.
 * rating "none" clears a previous rating (used by undo).
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{
    id?: string;
    rating?: string;
    comment?: string;
  }>(req, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (!body.id) return json({ error: "id required" }, 400);

  const sql = getSql();
  if (body.rating === "none") {
    await sql`
      UPDATE recommendations SET rating = NULL, comment = NULL, rated_at = NULL
      WHERE id = ${body.id} AND user_id = ${userId}`;
    return json({ ok: true }, 200);
  }
  if (!body.rating || !VALID.has(body.rating)) {
    return json({ error: "id and valid rating required" }, 400);
  }
  await sql`
    UPDATE recommendations
    SET rating = ${body.rating},
        comment = ${body.comment?.trim() || null},
        rated_at = now()
    WHERE id = ${body.id} AND user_id = ${userId}`;

  // A positive verdict (or "already know it") folds the track into the
  // library so it feeds future analysis, the map and recommendations.
  let addedToLibrary = false;
  if (body.rating === "superlike" || body.rating === "like" || body.rating === "known") {
    const rec = await sql`
      SELECT artist, title, album FROM recommendations
      WHERE id = ${body.id} AND user_id = ${userId}`;
    if (rec[0]) {
      await sql`SELECT add_liked_tracks(${userId}, ${JSON.stringify([
        { artist: rec[0].artist, title: rec[0].title, album: rec[0].album },
      ])}::jsonb)`;
      addedToLibrary = true;
    }
  }
  return json({ ok: true, addedToLibrary }, 200);
}
