import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/** Excludes an artist from analysis/stats (action omitted/exclude) or restores it (restore). */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{ artist?: string; action?: string }>(
    req,
    1024,
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const artist = (body.artist ?? "").trim();
  if (!artist) return json({ error: "artist required" }, 400);

  const sql = getSql();
  if (body.action === "restore") {
    await sql`DELETE FROM excluded_artists WHERE user_id = ${userId} AND artist = ${artist}`;
  } else {
    await sql`
      INSERT INTO excluded_artists (user_id, artist)
      VALUES (${userId}, ${artist})
      ON CONFLICT DO NOTHING`;
  }
  return json({ ok: true }, 200);
}
