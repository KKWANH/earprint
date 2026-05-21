import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { aiEnrichBatch } from "@/lib/aiEnrich";
import { json } from "@/lib/http";

/**
 * AI enrichment batch — fills genres for up to 8 tracks via Gemini.
 * Compilation/MV channels get re-mapped to the real artist. Client calls repeatedly.
 * Batch kept small so a single Gemini call stays well under request timeouts.
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
    LIMIT 8`;

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
