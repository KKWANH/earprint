import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { mbAlbumYear } from "@/lib/musicbrainz";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One batch of release-year backfill via MusicBrainz — looked up per album
 * (release group) for the genuine original year, then applied to every track
 * of that album. MusicBrainz allows ~1 request/second, so batches are small
 * and spaced; the client calls this until `remaining` hits 0.
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
    SELECT t.artist, t.album, array_agg(t.id) AS ids
    FROM tracks t
    JOIN user_tracks ut ON ut.track_id = t.id
    WHERE ut.user_id = ${userId} AND t.release_year IS NULL
      AND t.album IS NOT NULL AND t.album <> ''
    GROUP BY t.artist, t.album
    LIMIT 5`;

  const rows: { trackId: string; releaseYear: number; rank: null }[] = [];
  for (let i = 0; i < batch.length; i++) {
    const g = batch[i];
    const r = await mbAlbumYear(g.artist as string, g.album as string);
    // 0 = MB answered with no usable date (won't be re-fetched); a failed
    // fetch is skipped so the album stays NULL and is retried.
    if (r.ok) {
      for (const id of g.ids as string[]) {
        rows.push({ trackId: id, releaseYear: r.year ?? 0, rank: null });
      }
    }
    if (i < batch.length - 1) await sleep(1100); // MusicBrainz rate limit
  }
  if (rows.length > 0) {
    await sql`SELECT save_track_meta(${JSON.stringify(rows)}::jsonb)`;
  }

  const rem = await sql`
    SELECT count(DISTINCT (t.artist, t.album))::int AS n
    FROM tracks t
    JOIN user_tracks ut ON ut.track_id = t.id
    WHERE ut.user_id = ${userId} AND t.release_year IS NULL
      AND t.album IS NOT NULL AND t.album <> ''`;

  return json({ ok: true, processed: rows.length, remaining: rem[0].n as number }, 200);
}
