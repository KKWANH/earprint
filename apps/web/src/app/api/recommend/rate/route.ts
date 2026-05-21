import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

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

  let body: { id?: string; rating?: string; comment?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
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
  return json({ ok: true }, 200);
}
