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

/** 통계·분석에서 제외된 아티스트 목록. */
export async function getExcludedArtists(userId: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT artist FROM excluded_artists WHERE user_id = ${userId} ORDER BY artist`;
  return rows.map((r) => r.artist as string);
}

/** genres/moods jsonb 키 빈도 집계 — 제외 아티스트는 뺀다. */
async function topTags(
  sql: ReturnType<typeof getSql>,
  userId: string,
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
            AND t.artist NOT IN (SELECT artist FROM excluded_artists WHERE user_id = ${userId})
          GROUP BY k.key ORDER BY count DESC LIMIT 14`
      : await sql`
          SELECT k.key AS name, count(*)::int AS count
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN LATERAL jsonb_object_keys(a.moods) AS k(key)
          WHERE ut.user_id = ${userId} AND a.moods IS NOT NULL
            AND t.artist NOT IN (SELECT artist FROM excluded_artists WHERE user_id = ${userId})
          GROUP BY k.key ORDER BY count DESC LIMIT 14`;
  return rows.map((r) => ({ name: r.name as string, count: r.count as number }));
}

/** 라이브러리 분석 대시보드용 통계 (제외 아티스트 반영). */
export async function getLibraryStats(userId: string): Promise<LibraryStats> {
  const sql = getSql();

  const base = await sql`
    SELECT count(*)::int                 AS total,
           count(a.id)::int              AS enriched,
           count(*) FILTER (WHERE a.id IS NOT NULL AND a.genres IS NULL)::int AS missing_genres,
           count(DISTINCT t.artist)::int AS artists
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId}
      AND t.artist NOT IN (SELECT artist FROM excluded_artists WHERE user_id = ${userId})`;

  const artists = await sql`
    SELECT t.artist AS name, count(*)::int AS count
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    WHERE ut.user_id = ${userId}
      AND t.artist NOT IN (SELECT artist FROM excluded_artists WHERE user_id = ${userId})
    GROUP BY t.artist ORDER BY count DESC LIMIT 14`;

  const [topGenres, topMoods, excludedArtists] = await Promise.all([
    topTags(sql, userId, "genres"),
    topTags(sql, userId, "moods"),
    getExcludedArtists(userId),
  ]);

  const tracks = await sql`
    SELECT t.title, t.artist, t.album, a.genres, a.moods, t.deezer_id
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId}
      AND t.artist NOT IN (SELECT artist FROM excluded_artists WHERE user_id = ${userId})
    ORDER BY ut.captured_at DESC
    LIMIT 100`;

  return {
    total: base[0].total,
    enriched: base[0].enriched,
    missingGenres: base[0].missing_genres,
    distinctArtists: base[0].artists,
    topArtists: artists.map((r) => ({ name: r.name as string, count: r.count as number })),
    topGenres,
    topMoods,
    excludedArtists,
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
