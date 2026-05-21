import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

const VALID = new Set(["like", "dislike", "pass", "known"]);

/** Saves a recommendation rating — { id, rating, comment }. */
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
  if (!body.id || !body.rating || !VALID.has(body.rating)) {
    return json({ error: "id and valid rating required" }, 400);
  }

  const sql = getSql();
  await sql`
    UPDATE recommendations
    SET rating = ${body.rating},
        comment = ${body.comment?.trim() || null},
        rated_at = now()
    WHERE id = ${body.id} AND user_id = ${userId}`;

  return json({ ok: true }, 200);
}
