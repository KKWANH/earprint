import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { enrichTrack } from "@/lib/enrich";

/**
 * 분석 배치 처리 — 미분석 트랙 8곡을 Deezer + Last.fm 으로 보강한다.
 * 세션 인증. 클라이언트가 remaining 이 0 이 될 때까지 반복 호출.
 *
 * 배치 8곡 × 2콜 = 16 요청 — Worker CPU 한도(Error 1102) 회피용으로 작게 유지.
 */
export async function POST() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const sql = getSql();
  const batch = await sql`
    SELECT t.id, t.title, t.artist
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId} AND a.id IS NULL
    LIMIT 8`;

  if (batch.length > 0) {
    const rows = await Promise.all(
      batch.map(async (t) => ({
        trackId: t.id as string,
        ...(await enrichTrack(t.artist as string, t.title as string)),
      })),
    );
    await sql`SELECT save_enrichments(${JSON.stringify(rows)}::jsonb)`;
  }

  const stat = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE a.id IS NULL)::int AS remaining
    FROM user_tracks ut
    LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId}`;

  return json(
    { processed: batch.length, total: stat[0].total, remaining: stat[0].remaining },
    200,
  );
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
