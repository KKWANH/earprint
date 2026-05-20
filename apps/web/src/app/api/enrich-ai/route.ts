import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { aiEnrichBatch } from "@/lib/aiEnrich";

/**
 * AI 보강 배치 — 장르가 비어 있는 곡 20개를 Gemini 로 채운다.
 * 뮤비/모음 채널은 원곡 아티스트로 재매핑된다. 클라이언트가 반복 호출.
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
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    JOIN tracks t ON t.id = a.track_id
    WHERE ut.user_id = ${userId} AND a.analysis_version = 1 AND a.genres IS NULL
    LIMIT 20`;

  if (batch.length > 0) {
    let rows;
    try {
      rows = await aiEnrichBatch(
        batch.map((t) => ({
          id: t.id as string,
          artist: t.artist as string,
          title: t.title as string,
        })),
      );
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500);
    }
    await sql`SELECT save_ai_enrichments(${JSON.stringify(rows)}::jsonb)`;
  }

  const stat = await sql`
    SELECT count(*) FILTER (WHERE a.genres IS NULL)::int AS remaining
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    WHERE ut.user_id = ${userId} AND a.analysis_version = 1`;

  return json({ ok: true, processed: batch.length, remaining: stat[0].remaining }, 200);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
