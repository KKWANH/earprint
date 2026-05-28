import { getSql } from "./db";

/**
 * Lightweight "what did you play recently" rollup for the library
 * page. Returns:
 *   - count of plays in the last 7d
 *   - top 5 artists by play-count in the last 7d
 *   - count of distinct tracks played in the last 7d
 *
 * Hidden when the user has zero plays in the window (no Spotify
 * connection, or Spotify connected but /me/player/recently-played
 * returned nothing). All queries try/catch — a missing user_plays
 * table on a half-migrated deploy degrades to empty without
 * crashing the library page.
 */

export interface RecentPlaysRollup {
  weekTotal: number;
  distinctTracks: number;
  topArtists: { artist: string; plays: number }[];
}

export async function loadRecentPlays(
  userId: string,
): Promise<RecentPlaysRollup | null> {
  const sql = getSql();
  try {
    const totals = await sql`
      SELECT count(*)::int AS plays,
             count(DISTINCT track_id)::int AS distinct_tracks
      FROM user_plays
      WHERE user_id = ${userId}::uuid
        AND played_at > now() - interval '7 days'`;
    const weekTotal = (totals[0]?.plays as number) ?? 0;
    if (weekTotal === 0) return null;
    const distinctTracks = (totals[0]?.distinct_tracks as number) ?? 0;
    const artists = await sql`
      SELECT t.artist, count(*)::int AS plays
      FROM user_plays up
      JOIN tracks t ON t.id = up.track_id
      WHERE up.user_id = ${userId}::uuid
        AND up.played_at > now() - interval '7 days'
      GROUP BY t.artist
      ORDER BY plays DESC
      LIMIT 5`;
    return {
      weekTotal,
      distinctTracks,
      topArtists: artists.map((a) => ({
        artist: a.artist as string,
        plays: a.plays as number,
      })),
    };
  } catch {
    return null;
  }
}
