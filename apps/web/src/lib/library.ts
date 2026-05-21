import { getSql } from "@/lib/db";

export interface Count {
  name: string;
  count: number;
}
export interface TrackRow {
  title: string;
  artist: string;
  album: string | null;
  genres: string[] | null;
  moods: string[] | null;
  deezerId: number | null;
}
export interface LibraryStats {
  total: number;
  enriched: number;
  missingGenres: number;
  distinctArtists: number;
  topArtists: Count[];
  topGenres: Count[];
  topMoods: Count[];
  tracks: TrackRow[];
  excludedArtists: string[];
}

/** Artists excluded from stats / analysis. */
export async function getExcludedArtists(userId: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT artist FROM excluded_artists WHERE user_id = ${userId} ORDER BY artist`;
  return rows.map((r) => r.artist as string);
}

/** Frequency of genres/moods jsonb keys, with excluded artists removed. */
async function topTags(
  sql: ReturnType<typeof getSql>,
  userId: string,
  excluded: string[],
  column: "genres" | "moods",
): Promise<Count[]> {
  const rows =
    column === "genres"
      ? await sql`
          SELECT k.key AS name, count(*)::int AS count
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
          WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
            AND t.artist <> ALL(${excluded}::text[])
          GROUP BY k.key ORDER BY count DESC LIMIT 14`
      : await sql`
          SELECT k.key AS name, count(*)::int AS count
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN LATERAL jsonb_object_keys(a.moods) AS k(key)
          WHERE ut.user_id = ${userId} AND a.moods IS NOT NULL
            AND t.artist <> ALL(${excluded}::text[])
          GROUP BY k.key ORDER BY count DESC LIMIT 14`;
  return rows.map((r) => ({ name: r.name as string, count: r.count as number }));
}

/** Library dashboard stats (excluded artists applied). */
export async function getLibraryStats(userId: string): Promise<LibraryStats> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);

  const [base, artists, topGenres, topMoods, tracks] = await Promise.all([
    sql`
      SELECT count(*)::int                 AS total,
             count(a.id)::int              AS enriched,
             count(*) FILTER (WHERE a.id IS NOT NULL AND a.genres IS NULL)::int AS missing_genres,
             count(DISTINCT t.artist)::int AS artists
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])`,
    sql`
      SELECT t.artist AS name, count(*)::int AS count
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])
      GROUP BY t.artist ORDER BY count DESC LIMIT 14`,
    topTags(sql, userId, excluded, "genres"),
    topTags(sql, userId, excluded, "moods"),
    sql`
      SELECT t.title, t.artist, t.album, a.genres, a.moods, t.deezer_id
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])
      ORDER BY ut.captured_at DESC
      LIMIT 100`,
  ]);

  return {
    total: base[0].total,
    enriched: base[0].enriched,
    missingGenres: base[0].missing_genres,
    distinctArtists: base[0].artists,
    topArtists: artists.map((r) => ({ name: r.name as string, count: r.count as number })),
    topGenres,
    topMoods,
    excludedArtists: excluded,
    tracks: tracks.map((t) => ({
      title: t.title as string,
      artist: t.artist as string,
      album: (t.album as string) ?? null,
      deezerId: (t.deezer_id as number) ?? null,
      genres: t.genres ? Object.keys(t.genres as Record<string, unknown>) : null,
      moods: t.moods ? Object.keys(t.moods as Record<string, unknown>) : null,
    })),
  };
}
