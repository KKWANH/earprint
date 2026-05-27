import { getSql } from "@/lib/db";
import {
  findGenre,
  genreFamily,
  isExcludedGenre,
  listFamilies,
  type FamilyDef,
} from "./genreDict";

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
export interface FamilyCount {
  /** Family id (e.g. "rock", "asian_pop") — stable across i18n. */
  id: string;
  /** Localised label resolved from FamilyDef. */
  label: string;
  labelKo: string;
  count: number;
  /** Up to 3 top sub-genres in this family, for the "you have: indie pop,
   *  dream pop, shoegaze" hover tooltip on the bar. */
  sample: string[];
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
  /** Top family rollup — same genre signal as topGenres but bucketed
   *  into the 18 top-level families from genreDict. Lets the UI show
   *  "you're 38% Pop / 22% Rock / …" without the user squinting at
   *  every sub-genre row. */
  topFamilies: FamilyCount[];
  /** Region tag distribution (May 2026+ analyses only — empty for
   *  legacy rows). "korean" / "japanese" / "british" / "latin" /
   *  "african" etc. Populated as Gemini backfill runs. */
  topRegions: Count[];
  /** Era tag distribution (May 2026+ analyses only). "2020s" / "90s"
   *  / "modern" / "retro" etc. Drives the reminiscence-bump view. */
  topEras: Count[];
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
  // Genres: union of three sources, deduped + canonicalised in TS:
  //   1. NEW: analysis.primary_genre (single canonical id per track)
  //   2. NEW: analysis.sub_genres TEXT[] (additional ids per track)
  //   3. LEGACY: analysis.genres jsonb keys — used ONLY when both
  //      new columns are empty (= analyses run before the multi-label
  //      schema landed; haven't been backfilled yet).
  //
  // Over-fetch LIMIT 60 because dedup-by-canonical-id collapses
  // legacy and new IDs of the same genre into one row, so the raw
  // SQL output is naturally inflated. After TS dedup + family-exclude
  // we slice to 14.
  //
  // Moods don't have multi-label columns yet — keep legacy path.
  if (column === "genres") {
    const rows = await sql`
      WITH lib_size AS (
        SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
      ),
      genre_signal AS (
        -- new schema: primary_genre (1 per analysed track)
        SELECT ut.list_position, lib_size.n, a.primary_genre AS name
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        CROSS JOIN lib_size
        WHERE ut.user_id = ${userId}
          AND a.primary_genre IS NOT NULL
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
        UNION ALL
        -- new schema: sub_genres (N per analysed track)
        SELECT ut.list_position, lib_size.n, sg AS name
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        CROSS JOIN lib_size
        CROSS JOIN LATERAL unnest(coalesce(a.sub_genres, ARRAY[]::text[])) AS sg
        WHERE ut.user_id = ${userId}
          AND a.sub_genres IS NOT NULL
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
        UNION ALL
        -- legacy fallback: jsonb keys ONLY when BOTH new fields are
        -- null (= row predates the multi-label migration AND hasn't
        -- been backfilled). Double-counting prevention is the
        -- "primary_genre IS NULL AND sub_genres IS NULL" guard.
        SELECT ut.list_position, lib_size.n, k.key AS name
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        CROSS JOIN lib_size
        CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
        WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
          AND a.primary_genre IS NULL
          AND a.sub_genres IS NULL
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
      )
      SELECT name, count(*)::int AS count,
             sum(recency_weight(list_position, n))::real AS weighted
      FROM genre_signal
      WHERE name IS NOT NULL AND name <> ''
      GROUP BY name
      ORDER BY weighted DESC
      LIMIT 60`;
    // TS dedup: map every raw label to its genreDict canonical id so
    // "indie pop" (legacy) and "indie_pop" (new) collapse into one
    // row. Drop excluded families (religious / spoken / children /
    // novelty / ASMR) on the way through. Take top 14 by COUNT
    // (not weighted) so the displayed number matches the recency-
    // sorted order — i.e. the bars stay honest.
    const merged = new Map<
      string,
      { label: string; count: number; weighted: number }
    >();
    for (const r of rows) {
      const raw = r.name as string;
      if (isExcludedGenre(raw)) continue;
      const node = findGenre(raw);
      const key = node ? node.id : raw.toLowerCase().trim();
      const label = node ? node.label : raw;
      const entry = merged.get(key) ?? { label, count: 0, weighted: 0 };
      entry.count += r.count as number;
      entry.weighted += Number(r.weighted) || 0;
      merged.set(key, entry);
    }
    return [...merged.values()]
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 14)
      .map((v) => ({ name: v.label, count: v.count }));
  }
  const rows = await sql`
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

  const [base, artists, recentArtists, topGenres, topMoods, instruments, albums, depth, feel, tracks, allGenreRows, regionRows, eraRows] =
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
          -- Threshold lowered May 2026 from 3 → 2. Earprint is built
          -- on YT Music likes, where users rarely like an entire
          -- album — even an album they obsess over usually shows
          -- 2-3 likes. The old 3+ bar erased most of the signal;
          -- 2+ correctly captures "this album resonated enough
          -- that the user came back to it" without overstating it.
          GROUP BY t.album HAVING count(*) >= 2
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
      // Raw per-key genre counts (NOT LIMITed) — TS aggregates these into
      // the 18 families. We can't bucket in SQL because the family map
      // lives in genreDict.ts. Confidence filter still applies so
      // YouTuber junk doesn't reach the family rollup.
      //
      // Source priority mirrors topTags(): new schema first (primary +
      // sub), legacy jsonb only when both new fields are null.
      sql`
        SELECT name, count(*)::int AS count FROM (
          SELECT a.primary_genre AS name
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          WHERE ut.user_id = ${userId} AND a.primary_genre IS NOT NULL
            AND t.artist <> ALL(${excluded}::text[])
            AND (NOT t.resolved OR t.match_confidence >= 0.65)
          UNION ALL
          SELECT sg AS name
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN LATERAL unnest(coalesce(a.sub_genres, ARRAY[]::text[])) AS sg
          WHERE ut.user_id = ${userId} AND a.sub_genres IS NOT NULL
            AND t.artist <> ALL(${excluded}::text[])
            AND (NOT t.resolved OR t.match_confidence >= 0.65)
          UNION ALL
          SELECT k.key AS name
          FROM analysis a
          JOIN user_tracks ut ON ut.track_id = a.track_id
          JOIN tracks t ON t.id = a.track_id
          CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
          WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
            AND a.primary_genre IS NULL AND a.sub_genres IS NULL
            AND t.artist <> ALL(${excluded}::text[])
            AND (NOT t.resolved OR t.match_confidence >= 0.65)
        ) s
        WHERE name IS NOT NULL AND name <> ''
        GROUP BY name`,
      // Region tag rollup — only available when analysis was run with
      // the multi-label prompt (May 2026+). Powers a future "your
      // library by region" UI; populated lazily as backfill runs.
      sql`
        SELECT rt AS name, count(*)::int AS count
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        CROSS JOIN LATERAL unnest(coalesce(a.region_tags, ARRAY[]::text[])) AS rt
        WHERE ut.user_id = ${userId} AND a.region_tags IS NOT NULL
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
        GROUP BY rt
        ORDER BY count DESC
        LIMIT 8`,
      // Era tag rollup — same caveat as region. "70s" / "2020s" / etc.
      sql`
        SELECT et AS name, count(*)::int AS count
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        JOIN tracks t ON t.id = a.track_id
        CROSS JOIN LATERAL unnest(coalesce(a.era_tags, ARRAY[]::text[])) AS et
        WHERE ut.user_id = ${userId} AND a.era_tags IS NOT NULL
          AND t.artist <> ALL(${excluded}::text[])
          AND (NOT t.resolved OR t.match_confidence >= 0.65)
        GROUP BY et
        ORDER BY count DESC
        LIMIT 6`,
    ]);

  // ── Family rollup. Each genre key maps via genreDict.genreFamily()
  // into one of the 18 top-level buckets. Excluded families
  // (Religious / Spoken / Children) are silently dropped — they
  // already get filtered from topGenres, no point surfacing them in
  // the family chart either. Unknown genre keys (not in the dict)
  // bucket into "other" so the user can see how much vocabulary we
  // didn't recognise. ──
  const famAcc = new Map<string, { count: number; sample: Array<{ name: string; count: number }> }>();
  for (const r of allGenreRows as Array<{ name: string; count: number }>) {
    const fam = genreFamily(r.name);
    if (!fam) continue;
    if (isExcludedGenre(r.name)) continue;
    const entry = famAcc.get(fam) ?? { count: 0, sample: [] };
    entry.count += r.count;
    entry.sample.push({ name: r.name, count: r.count });
    famAcc.set(fam, entry);
  }
  const familyMeta: Record<string, FamilyDef> = Object.fromEntries(
    listFamilies().map((f) => [f.id, f]),
  );
  const topFamilies: FamilyCount[] = [...famAcc.entries()]
    .map(([id, v]) => {
      const meta = familyMeta[id];
      return {
        id,
        label: meta?.label ?? id,
        labelKo: meta?.labelKo ?? id,
        count: v.count,
        sample: v.sample
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((s) => s.name),
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);

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
    topFamilies,
    topRegions: regionRows.map((r) => ({
      name: r.name as string,
      count: r.count as number,
    })),
    topEras: eraRows.map((r) => ({
      name: r.name as string,
      count: r.count as number,
    })),
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
