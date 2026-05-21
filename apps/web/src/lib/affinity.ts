import { getSql } from "./db";

/**
 * Per-artist preference weight — how much the user likes each artist.
 *   1 = normal · 2 = 좋아함 · 3 = 최애
 * Unrated artists are simply absent (treated as 1).
 */
export async function getAffinities(userId: string): Promise<Record<string, number>> {
  const sql = getSql();
  const rows = await sql`
    SELECT artist, weight FROM artist_affinity WHERE user_id = ${userId}`;
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[(r.artist as string).toLowerCase()] = r.weight as number;
  }
  return out;
}
