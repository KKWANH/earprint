import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";

/** 아티스트를 분석/통계에서 제외하거나(action 미지정/exclude) 복원한다(restore). */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { artist?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
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

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
