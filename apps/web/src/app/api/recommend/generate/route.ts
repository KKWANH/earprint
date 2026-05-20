import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateRecommendations } from "@/lib/recommend";

/** 추천 후보를 생성해 recommendations 에 저장한다. */
export async function POST() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let added = 0;
  try {
    const rows = await generateRecommendations(userId);
    if (rows.length > 0) {
      const sql = getSql();
      const res = await sql`
        SELECT save_recommendations(${userId}, ${JSON.stringify(rows)}::jsonb) AS n`;
      added = (res[0].n as number) ?? 0;
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }

  const sql = getSql();
  const stat = await sql`
    SELECT count(*) FILTER (WHERE rating IS NULL)::int AS unrated
    FROM recommendations WHERE user_id = ${userId}`;

  return json({ ok: true, added, unrated: stat[0].unrated }, 200);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
