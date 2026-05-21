import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateBlurb } from "@/lib/blurb";
import { json } from "@/lib/http";

/**
 * Lazily generates a track's history/significance blurb via Gemini.
 * Cached on the recommendations row after the first request.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.id) return json({ error: "id required" }, 400);

  const sql = getSql();
  const rows = await sql`
    SELECT artist, title, blurb FROM recommendations
    WHERE id = ${body.id} AND user_id = ${userId}`;
  if (rows.length === 0) return json({ error: "not found" }, 404);
  if (rows[0].blurb) return json({ ok: true, blurb: rows[0].blurb as string }, 200);

  try {
    const blurb = await generateBlurb(rows[0].artist as string, rows[0].title as string);
    await sql`UPDATE recommendations SET blurb = ${blurb} WHERE id = ${body.id}`;
    return json({ ok: true, blurb }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
