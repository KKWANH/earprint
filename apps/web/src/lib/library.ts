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
  /** Top artists drawn ONLY from the most-recent third of the library
   *  (lowest list_position values). Useful to show what the user is
   *  *currently* into vs. the all-time-weighted topArtists. Empty when
   *  the user hasn't synced since list_position rolled out. */
  recentArtists: Count[];
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

export interface TracksPage {
  tracks: TrackRow[];
  /** Total rows matching the (q + excluded-artist) filter — used to render
   *  the pagination footer. NOT the same as user's `stats.total`, which
   *  is unfiltered. */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated + searchable track list for the Library page. Separate from
 * `getLibraryStats()` so the stats card doesn't have to re-run when the
 * user only changes the search query — keeps the page snappy on big
 * libraries where the stats query is the slow part.
 *
 * Search matches title OR artist (ILIKE, both sides %q%). Excluded
 * artists are filtered out the same way as in the stats. The tracks
 * table intentionally shows ALL rows including low-Deezer-confidence
 * ones — the user needs to see their actual library as they synced it,
 * not a Deezer-filtered subset.
 */
export async function getLibraryTracks(
  userId: string,
  opts: { q?: string; page?: number; pageSize?: number } = {},
): Promise<TracksPage> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);
  const page = Math.max(1, opts.page ?? 1);
  // 50 keeps the table comfortable on mobile (~1.5 viewports). Hard
  // ceiling at 200 so a bookmarked ?pageSize=10000 can't blow up the
  // worker memory or rendering.
  const pageSize = Math.min(200, Math.max(10, opts.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  // Wildcard pattern, ILIKE-safe — wrap user input with %…% and escape
  // %/_ so a search for "50%" doesn't suddenly mean "anything containing
  // 50 followed by anything".
  const q = (opts.q ?? "").trim();
  const hasQ = q.length > 0;
  const pat = hasQ
    ? `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`
    : "";

  const [countRow, rows] = await Promise.all([
    hasQ
      ? sql`
          SELECT count(*)::int AS total
          FROM user_tracks ut
          JOIN tracks t ON t.id = ut.track_id
          WHERE ut.user_id = ${userId}
            AND t.artist <> ALL(${excluded}::text[])
            AND (t.title ILIKE ${pat} OR t.artist ILIKE ${pat})`
      : sql`
          SELECT count(*)::int AS total
          FROM user_tracks ut
          JOIN tracks t ON t.id = ut.track_id
          WHERE ut.user_id = ${userId}
            AND t.artist <> ALL(${excluded}::text[])`,
    hasQ
      ? sql`
          SELECT t.title, t.artist, t.album, a.genres, a.moods, t.deezer_id
          FROM user_tracks ut
          JOIN tracks t ON t.id = ut.track_id
          LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
          WHERE ut.user_id = ${userId}
            AND t.artist <> ALL(${excluded}::text[])
            AND (t.title ILIKE ${pat} OR t.artist ILIKE ${pat})
          ORDER BY ut.captured_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`
      : sql`
          SELECT t.title, t.artist, t.album, a.genres, a.moods, t.deezer_id
          FROM user_tracks ut
          JOIN tracks t ON t.id = ut.track_id
          LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
          WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])
          ORDER BY ut.captured_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`,
  ]);

  return {
    tracks: rows.map((t) => ({
      title: t.title as string,
      artist: t.artist as string,
      album: (t.album as string) ?? null,
      deezerId: (t.deezer_id as number) ?? null,
      genres: t.genres ? Object.keys(t.genres as Record<string, unknown>) : null,
      moods: t.moods ? Object.keys(t.moods as Record<string, unknown>) : null,
    })),
    total: countRow[0].total as number,
    page,
    pageSize,
  };
}

/**
 * Stat-quality filter — keeps a track OUT of the Top-X aggregates when the
 * Deezer enrichment couldn't find it (= almost always a YouTuber cover,
 * 1-hour mix, fan-made compilation, or non-music video the user liked on
 * YT Music). The bar is the same 0.65 threshold the metadata-suppression
 * path already uses (see deezer.ts HIGH_CONFIDENCE).
 *
 * Semantics:
 *   • not resolved yet           → include (give pending enrichments
 *                                  the benefit of the doubt; otherwise a
 *                                  freshly-synced library shows empty
 *                                  Top Artists until cron catches up)
 *   • resolved, confidence ≥0.65 → include
 *   • resolved, confidence <0.65 → EXCLUDE (YouTuber / cover / etc.)
 *   • resolved, confidence NULL  → EXCLUDE (Deezer returned no match
 *                                  at all = same outcome as 0)
 *
 * Applied to every "Top X" / aggregate stat, but NOT to the tracks table
 * (the user needs to see their actual library, low-confidence rows and
 * all — that's the source of truth they synced).
 */
const STAT_CONFIDENCE_FILTER = `(NOT t.resolved OR t.match_confidence >= 0.65)`;

/** Frequency of genres/moods jsonb keys, with excluded artists removed. */
// Top tags (genres or moods), recency-weighted in the ORDER BY only.
// Same pattern as topArtists above: literal track count stays in the
// returned `count` column so the UI doesn't show "12.7 tracks", but
// sorting uses sum(recency_weight(...)) so a tag that's mostly in recent
// likes wins over a tag that's mostly old. Without this, someone whose
// taste shifted from rock to ambient still saw "rock" as their #1 tag.
async function topTags(
  sql: ReturnType<typeof getSql>,
  userId: string,
  excluded: string[],
  column: "genres" | "moods",
): Promise<Count[]> {
  const rows =
    column === "genres"
      ? await sql`
          WITH lib_size AS (
            SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
          )
          SELECT k.key AS name, count(*)::int AS count
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN lib_size
          CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
          WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
            AND t.artist <> ALL(${excluded}::text[])
            AND (NOT t.resolved OR t.match_confidence >= 0.65)
          GROUP BY k.key
          ORDER BY sum(recency_weight(ut.list_position, lib_size.n)) DESC
          LIMIT 14`
      : await sql`
          WITH lib_size AS (
            SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
          )
          SELECT k.key AS name, count(*)::int AS count
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN lib_size
          CROSS JOIN LATERAL jsonb_object_keys(a.moods) AS k(key)
          WHERE ut.user_id = ${userId} AND a.moods IS NOT NULL
            AND t.artist <> ALL(${excluded}::text[])
            AND (NOT t.resolved OR t.match_confidence >= 0.65)
          GROUP BY k.key
          ORDER BY sum(recency_weight(ut.list_position, lib_size.n)) DESC
          LIMIT 14`;
  return rows.map((r) => ({ name: r.name as string, count: r.count as number }));
}

// Reference the filter constant so future tooling can find this comment
// from the constant. Inline above for SQL template clarity — neon's
// tagged-template binding doesn't expand non-parameter strings, so we
// can't ${STAT_CONFIDENCE_FILTER} interpolate.
void STAT_CONFIDENCE_FILTER;

/** Library dashboard stats (excluded artists applied). */
export async function getLibraryStats(userId: string): Promise<LibraryStats> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);

  const [base, artists, recentArtists, topGenres, topMoods, instruments, albums, depth, feel, tracks] =
    await Promise.all([
      // Base counts. `total` and `enriched` here are AGGREGATE PROGRESS
      // numbers so we keep them honest (no confidence filter — the user
      // synced 1,417 tracks, that's the truth). `artists` is the count
      // shown in headline stats; we filter it so YouTuber/Topic-channel
      // junk doesn't inflate the "you have N artists" claim.
      sql`
        SELECT count(*)::int                                                    AS total,
               count(a.id)::int                                                 AS enriched,
               count(*) FILTER (WHERE a.id IS NOT NULL AND a.genres IS NULL)::int AS missing_genres,
               count(DISTINCT artist_canon(t.artist, t.deezer_artist_id))
                 FILTER (WHERE NOT t.resolved OR t.match_confidence >= 0.65)::int AS artists
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
        WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])`,
      // Top artists, recency-weighted: literal track count stays in the
      // returned column (UI says "N tracks"), but ORDER BY uses a
      // recency-boosted sum so an artist with 6 fresh likes outranks an
      // artist with 8 likes from 2019. Boost is bounded (1.0–2.0×) so
      // catalog depth still matters. Confidence filter keeps YouTuber
      // covers / "1 hour relax mix" channels out of the Top.
      sql`
        WITH lib_size AS (
          SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
        )
        SELECT artist_canon(t.artist, t.deezer_artist_id) AS name,
               count(*)::int AS count
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        CROSS JOIN lib_size
        WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
        GROUP BY artist_canon(t.artist, t.deezer_artist_id)
        ORDER BY sum(recency_weight(ut.list_position, lib_size.n)) DESC
        LIMIT 14`,
      // "Recent picks": top artists drawn ONLY from the most recently
      // liked quarter (or 50 songs, whichever's bigger). Lets the user
      // see "what I'm into NOW" separately from the all-time top. Empty
      // when list_position hasn't been populated yet (legacy sync).
      sql`
        WITH lib_size AS (
          SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
        ),
        window_size AS (
          SELECT greatest(50, n / 4)::int AS cutoff FROM lib_size
        )
        SELECT artist_canon(t.artist, t.deezer_artist_id) AS name,
               count(*)::int AS count
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        CROSS JOIN window_size
        WHERE ut.user_id = ${userId}
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
          AND ut.list_position IS NOT NULL
          AND ut.list_position < window_size.cutoff
        GROUP BY artist_canon(t.artist, t.deezer_artist_id)
        ORDER BY count DESC
        LIMIT 10`,
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
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
        GROUP BY inst ORDER BY count DESC LIMIT 10`,
      sql`
        SELECT t.album AS name, count(*)::int AS count
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        WHERE ut.user_id = ${userId} AND t.album IS NOT NULL AND t.album <> ''
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
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
            AND (NOT t.resolved OR t.match_confidence >= 0.65)
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
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)`,
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
    recentArtists: recentArtists.map((r) => ({
      name: r.name as string, count: r.count as number,
    })),
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
