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
export interface AudioFeelAgg {
  analyzed: number;
  energy: number;
  tempo: number;
  acousticness: number;
}
export interface AlbumDepth {
  deepAlbums: number; // albums with >= 3 liked tracks
  concentration: number; // fraction of liked tracks that sit in deep albums
}
export interface LibraryStats {
  total: number;
  enriched: number;
  missingGenres: number;
  distinctArtists: number;
  topArtists: Count[];
  topGenres: Count[];
  topMoods: Count[];
  topInstruments: Count[];
  topAlbums: Count[];
  audioFeel: AudioFeelAgg | null;
  albumDepth: AlbumDepth;
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

  const [base, artists, topGenres, topMoods, instruments, albums, depth, feel, tracks] =
    await Promise.all([
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
        SELECT inst AS name, count(*)::int AS count
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        CROSS JOIN LATERAL jsonb_array_elements_text(a.audio_feel -> 'instruments') AS inst
        WHERE ut.user_id = ${userId} AND a.audio_feel ? 'instruments'
          AND t.artist <> ALL(${excluded}::text[])
        GROUP BY inst ORDER BY count DESC LIMIT 10`,
      sql`
        SELECT t.album AS name, count(*)::int AS count
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        WHERE ut.user_id = ${userId} AND t.album IS NOT NULL AND t.album <> ''
          AND t.artist <> ALL(${excluded}::text[])
        GROUP BY t.album HAVING count(*) >= 2
        ORDER BY count DESC LIMIT 12`,
      sql`
        SELECT count(*)::int AS deep_albums, coalesce(sum(c), 0)::int AS deep_tracks
        FROM (
          SELECT count(*) AS c
          FROM user_tracks ut
          JOIN tracks t ON t.id = ut.track_id
          WHERE ut.user_id = ${userId} AND t.album IS NOT NULL AND t.album <> ''
            AND t.artist <> ALL(${excluded}::text[])
          GROUP BY t.album HAVING count(*) >= 3
        ) s`,
      sql`
        SELECT count(*)::int AS analyzed,
               avg((a.audio_feel ->> 'energy')::float)       AS energy,
               avg((a.audio_feel ->> 'tempo')::float)        AS tempo,
               avg((a.audio_feel ->> 'acousticness')::float) AS acousticness
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        WHERE ut.user_id = ${userId} AND a.audio_feel ? 'energy'
          AND t.artist <> ALL(${excluded}::text[])`,
      sql`
        SELECT t.title, t.artist, t.album, a.genres, a.moods, t.deezer_id
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
        WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])
        ORDER BY ut.captured_at DESC
        LIMIT 100`,
    ]);

  const total = base[0].total as number;
  const analyzed = feel[0].analyzed as number;
  const deepTracks = depth[0].deep_tracks as number;

  return {
    total,
    enriched: base[0].enriched as number,
    missingGenres: base[0].missing_genres as number,
    distinctArtists: base[0].artists as number,
    topArtists: artists.map((r) => ({ name: r.name as string, count: r.count as number })),
    topGenres,
    topMoods,
    topInstruments: instruments.map((r) => ({
      name: r.name as string,
      count: r.count as number,
    })),
    topAlbums: albums.map((r) => ({ name: r.name as string, count: r.count as number })),
    audioFeel:
      analyzed > 0
        ? {
            analyzed,
            energy: Number(feel[0].energy) || 0,
            tempo: Number(feel[0].tempo) || 0,
            acousticness: Number(feel[0].acousticness) || 0,
          }
        : null,
    albumDepth: {
      deepAlbums: depth[0].deep_albums as number,
      concentration: total > 0 ? deepTracks / total : 0,
    },
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
