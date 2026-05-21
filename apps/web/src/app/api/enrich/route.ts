import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { enrichTrack } from "@/lib/enrich";
import { json } from "@/lib/http";

/**
 * Enrichment batch — fills 8 unanalyzed tracks via Deezer + Last.fm.
 * Session-authenticated. The client calls repeatedly until remaining hits 0.
 * Batch of 8 keeps the per-request API calls under the Workers subrequest limit.
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
