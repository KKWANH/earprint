import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getJson, json } from "@/lib/http";

/** Parses a 4-digit year out of a Deezer release_date. */
function yearOf(date: unknown): number | null {
  const m = typeof date === "string" ? date.match(/^(\d{4})/) : null;
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= new Date().getFullYear() + 1 ? y : null;
}

/**
 * One batch of release-year backfill (drives the reminiscence-bump analysis).
 * Tracks Deezer has no date for are stored as year 0 so they are not re-fetched.
 * The client calls this repeatedly until `remaining` hits 0.
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
    SELECT t.id, t.deezer_id
    FROM tracks t
    JOIN user_tracks ut ON ut.track_id = t.id
    WHERE ut.user_id = ${userId} AND t.deezer_id IS NOT NULL AND t.release_year IS NULL
    GROUP BY t.id, t.deezer_id
    LIMIT 25`;

  if (batch.length > 0) {
    const rows = await Promise.all(
      batch.map(async (t) => {
        let year: number | null = null;
        let rank: number | null = null;
        try {
          const d = await getJson(`https://api.deezer.com/track/${t.deezer_id}`);
          year = yearOf(d?.release_date) ?? yearOf(d?.album?.release_date);
          rank = typeof d?.rank === "number" ? d.rank : null;
        } catch {
          /* leave as unknown */
        }
        // 0 = "checked, no date" — keeps the row out of the next batch.
        return { trackId: t.id, releaseYear: year ?? 0, rank };
      }),
    );
    await sql`SELECT save_track_meta(${JSON.stringify(rows)}::jsonb)`;
  }

  const rem = await sql`
    SELECT count(*)::int AS n
    FROM tracks t
    JOIN user_tracks ut ON ut.track_id = t.id
    WHERE ut.user_id = ${userId} AND t.deezer_id IS NOT NULL AND t.release_year IS NULL`;

  return json({ ok: true, processed: batch.length, remaining: rem[0].n as number }, 200);
}
