import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateRecommendations } from "@/lib/recommend";
import { json } from "@/lib/http";

/** Generates recommendation candidates and stores them in recommendations. */
export async function POST() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const sql = getSql();
  let added = 0;
  try {
    const rows = await generateRecommendations(userId);
    if (rows.length > 0) {
      const res = await sql`
        SELECT save_recommendations(${userId}, ${JSON.stringify(rows)}::jsonb) AS n`;
      added = (res[0].n as number) ?? 0;
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }

  const stat = await sql`
    SELECT count(*) FILTER (WHERE rating IS NULL)::int AS unrated
    FROM recommendations WHERE user_id = ${userId}`;

  return json({ ok: true, added, unrated: stat[0].unrated }, 200);
}
