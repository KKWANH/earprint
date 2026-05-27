/**
 * Candidate fetchers for the /worldcup bracket page.
 *
 * Worldcup's product purpose is the "self-bracket" — let the user rank
 * pieces of their OWN library against each other. The previous default
 * (`liked` = top-N by recency-weight) surfaced only the newest likes
 * regardless of bracket size, so a user with 5k tracks running a 32-cup
 * was bracketing the same 32 newest songs every time, which defeats the
 * whole point. The category set below replaces that with three honest
 * "self-bracket" modes against the library plus the two "vs-the-world"
 * modes (discover / mix) that already existed:
 *
 *   • library   — uniform-random sample across the WHOLE library. The
 *                 every-corner-represented bracket. Default for /worldcup.
 *   • recent    — top N by recency-weight. The old `liked` behaviour —
 *                 kept because "rank the last few months" is its own
 *                 valid mode.
 *   • forgotten — random sample drawn from the oldest portion of the
 *                 library (high list_position). Surfaces tracks the user
 *                 hasn't seen in their own brackets in ages.
 *   • discover  — recommendations table, top N by score.
 *   • mix       — interleaved 50/50 of library + discover.
 *   • genre     — separate runner with its own card UI (see below).
 *
 * "최애 장르" (favorite genre) has a different card UI (genre name +
 * sample tracks instead of cover/artist/title), so it lives in its own
 * runner at /worldcup/genre/[size]/page.tsx and uses getGenreCandidates
 * directly. `getCandidates("genre", …)` returns [] for that reason.
 *
 * Backward-compat: the legacy `liked` path resolves to `library`
 * semantics (the new sensible default) so any deep link bookmarked
 * before this rebuild still works rather than 404ing.
 */

import { getSql } from "./db";

export type WorldcupCategory =
  | "library"
  | "recent"
  | "forgotten"
  | "discover"
  | "mix"
  | "genre"
  /** Legacy alias — keeps pre-rebuild /worldcup/liked/N links working.
   *  Dispatcher routes it to library semantics. */
  | "liked";

// 256강 = 255 picks = ~12 min of clicking. The big-bracket users
// (~1500-song libraries) explicitly asked for it; smaller libraries
// just see it greyed out in the picker.
export const WORLDCUP_SIZES = [8, 16, 32, 64, 128, 256] as const;
export type WorldcupSize = (typeof WORLDCUP_SIZES)[number];

export interface BracketCandidate {
  id: string;
  artist: string;
  title: string;
  coverUrl: string | null;
  deezerId: number | null;
  score: number | null;
  recType: string;
}

/** Genre-specific candidate. Genre bracket needs different card UI
 *  (genre name + sample tracks + colour swatch) so it gets its own
 *  type and its own page — the worldcup runner branches on cat=genre. */
export interface GenreCandidate {
  /** Genre name as it appears in user's analysis.genres jsonb keys. */
  id: string;
  /** Display name (matches id for now — kept separate in case we ever
   *  want a friendlier label per genre). */
  name: string;
  /** Track count for this genre in the user's library. Used for the
   *  favorites/opposites bracket patterns and as a secondary signal
   *  on each card. */
  count: number;
  /** This genre's share of the user's total analysed library (0..1).
   *  Surfaced as a "% of your library" badge — comparing a 22% genre
   *  to a 4% niche genre on the card helps the user decide whether
   *  the bracket's question is "your core" vs "your spice". */
  libraryShare: number;
  /** Three sample (artist, title) pairs from the user's library so the
   *  card has something concrete on it — picking "hip-hop" vs "indie"
   *  is hard without a reminder of what each contains for you. */
  samples: { artist: string; title: string }[];
}

export async function getCandidates(
  userId: string,
  category: WorldcupCategory,
  size: WorldcupSize,
): Promise<BracketCandidate[]> {
  switch (category) {
    case "library":   return getLibraryRandomCandidates(userId, size);
    case "recent":    return getRecentCandidates(userId, size);
    case "forgotten": return getForgottenCandidates(userId, size);
    case "discover":  return getDiscoverCandidates(userId, size);
    case "mix":       return getMixedCandidates(userId, size);
    case "liked":     return getLibraryRandomCandidates(userId, size); // legacy alias
    case "genre":     return []; // Genre uses its own runner — call getGenreCandidates directly
    default: {
      // Exhaustive switch — if a new WorldcupCategory value is added
      // to the union without a case here, TypeScript will fail this
      // assignment at compile time. Better than the runtime "0 cards
      // in the bracket" symptom the old code produced.
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

/** Top-N genres by user's listening count + three sample tracks each.
 *  Genre brackets cap at how many genres the user actually has — we
 *  don't pad with empty genres. */
export async function getGenreCandidates(
  userId: string,
  size: number,
): Promise<GenreCandidate[]> {
  const sql = getSql();
  // First: rank genres by recency-weighted listening, take top `size`.
  // analysedTotal is the # of user tracks that have at least one genre
  // tag — used as the denominator for libraryShare. Tracks without
  // analysis would unfairly shrink any genre's share otherwise.
  const ranked = await sql`
    WITH lib_size AS (
      SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
    ),
    analysed AS (
      SELECT count(DISTINCT ut.track_id)::int AS n
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
    )
    SELECT k.key AS name,
           count(*)::int AS count,
           (count(*)::real / NULLIF((SELECT n FROM analysed), 0))::real AS share
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    CROSS JOIN lib_size
    CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
    WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
    GROUP BY k.key
    ORDER BY sum(recency_weight(ut.list_position, lib_size.n)) DESC
    LIMIT ${size}`;
  if (ranked.length === 0) return [];

  // Then: for each, fetch up to 3 representative tracks the user liked.
  // One query per genre would be N+1 — instead one query with LATERAL.
  const genres = ranked.map((r) => r.name as string);
  const samples = await sql`
    SELECT genre, artist, title FROM (
      SELECT k.key AS genre, t.artist, t.title,
             row_number() OVER (PARTITION BY k.key ORDER BY random()) AS rn
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      JOIN tracks t ON t.id = a.track_id
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
      WHERE ut.user_id = ${userId}
        AND k.key = ANY(${genres}::text[])
    ) s WHERE rn <= 3`;
  const byGenre = new Map<string, { artist: string; title: string }[]>();
  for (const s of samples) {
    const arr = byGenre.get(s.genre as string) ?? [];
    arr.push({ artist: s.artist as string, title: s.title as string });
    byGenre.set(s.genre as string, arr);
  }
  return ranked.map((r) => ({
    id: r.name as string,
    name: r.name as string,
    count: r.count as number,
    libraryShare: (r.share as number) ?? 0,
    samples: byGenre.get(r.name as string) ?? [],
  }));
}

/** Uniform-random sample across the user's FULL library.
 *  The default-and-most-useful bracket mode: a 32-cup on a 5,000-track
 *  library actually represents the library, not just its latest 32
 *  likes. ORDER BY random() is the right tool here — for libraries up
 *  to ~10k it costs a sort that takes single-digit ms, and the result
 *  reshuffles every visit which is exactly what the user wants for
 *  re-running the same bracket size. */
async function getLibraryRandomCandidates(
  userId: string,
  size: number,
): Promise<BracketCandidate[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT t.id::text  AS id,
           t.artist    AS artist,
           t.title     AS title,
           t.deezer_id AS deezer_id
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    WHERE ut.user_id = ${userId}
    ORDER BY random()
    LIMIT ${size}`;
  return rows.map((r) => ({
    id: r.id as string,
    artist: r.artist as string,
    title: r.title as string,
    coverUrl: null,
    deezerId: (r.deezer_id as number) ?? null,
    score: null,
    recType: "library",
  }));
}

/** Top-N liked tracks by recency-weighted score. The previous default;
 *  kept as `recent` for users who specifically want a "rank the last
 *  few months" bracket. Caps at the requested bracket size; smaller
 *  libraries return everything they have. */
async function getRecentCandidates(
  userId: string,
  size: number,
): Promise<BracketCandidate[]> {
  const sql = getSql();
  const rows = await sql`
    WITH lib_size AS (
      SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
    )
    SELECT t.id::text          AS id,
           t.artist             AS artist,
           t.title              AS title,
           t.deezer_id          AS deezer_id,
           recency_weight(ut.list_position, lib_size.n)::real AS score
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    CROSS JOIN lib_size
    WHERE ut.user_id = ${userId}
    ORDER BY recency_weight(ut.list_position, lib_size.n) DESC, random()
    LIMIT ${size}`;
  return rows.map((r) => ({
    id: r.id as string,
    artist: r.artist as string,
    title: r.title as string,
    coverUrl: null,
    deezerId: (r.deezer_id as number) ?? null,
    score: (r.score as number) ?? null,
    recType: "recent",
  }));
}

/** Random sample from the oldest 50% of the user's library by
 *  list_position. The "rediscovery" / "forgotten gems" mode — tracks
 *  the user liked long ago that haven't surfaced in any recent bracket.
 *
 *  Falls back to a uniform random sample over the full library when
 *  the user has no non-NULL list_position values — that's the case
 *  for libraries synced before list_position rolled out, where the
 *  percentile_cont query would return zero rows and leave the bracket
 *  empty. Better to show SOMETHING than to silently 404 the mode.
 */
async function getForgottenCandidates(
  userId: string,
  size: number,
): Promise<BracketCandidate[]> {
  const sql = getSql();
  // Threshold = median list_position; sampling from rows with position
  // > median catches "older half of the library" without needing a
  // fixed magic number that breaks at different library sizes.
  const rows = await sql`
    WITH lib AS (
      SELECT ut.track_id, ut.list_position,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY ut.list_position)
               OVER () AS median_pos
      FROM user_tracks ut
      WHERE ut.user_id = ${userId} AND ut.list_position IS NOT NULL
    )
    SELECT t.id::text  AS id,
           t.artist    AS artist,
           t.title     AS title,
           t.deezer_id AS deezer_id
    FROM lib
    JOIN tracks t ON t.id = lib.track_id
    WHERE lib.list_position >= lib.median_pos
    ORDER BY random()
    LIMIT ${size}`;
  if (rows.length === 0) {
    // Legacy-library fallback: no position metadata to compute "old
    // half" against, so just hand back a uniform random sample.
    return getLibraryRandomCandidates(userId, size);
  }
  return rows.map((r) => ({
    id: r.id as string,
    artist: r.artist as string,
    title: r.title as string,
    coverUrl: null,
    deezerId: (r.deezer_id as number) ?? null,
    score: null,
    recType: "forgotten",
  }));
}

/** Top-N recommendations by predicted-fit score. Falls back to created_at
 *  when score is null (older rows from before the column was added). */
async function getDiscoverCandidates(
  userId: string,
  size: number,
): Promise<BracketCandidate[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id::text             AS id,
           artist,
           title,
           cover_url             AS cover_url,
           deezer_id             AS deezer_id,
           score,
           rec_type              AS rec_type
    FROM recommendations
    WHERE user_id = ${userId}
    ORDER BY score DESC NULLS LAST, created_at DESC
    LIMIT ${size}`;
  return rows.map((r) => ({
    id: r.id as string,
    artist: r.artist as string,
    title: r.title as string,
    coverUrl: (r.cover_url as string) ?? null,
    deezerId: (r.deezer_id as number) ?? null,
    score: (r.score as number) ?? null,
    recType: (r.rec_type as string) ?? "song",
  }));
}

/** 50/50 mix of random library + discover, interleaved so the bracket's
 *  first round naturally pits "familiar pick vs. new suggestion". Uses
 *  the random library sampler (not recent) so the bracket spans more
 *  of the user's actual taste — mixing "newest 32 likes vs. discover"
 *  is the worst of both worlds: small + already-seen. */
async function getMixedCandidates(
  userId: string,
  size: number,
): Promise<BracketCandidate[]> {
  const half = Math.ceil(size / 2);
  const [library, discover] = await Promise.all([
    getLibraryRandomCandidates(userId, half),
    getDiscoverCandidates(userId, half),
  ]);
  const out: BracketCandidate[] = [];
  for (let i = 0; i < half; i++) {
    if (library[i]) out.push(library[i]!);
    if (discover[i]) out.push(discover[i]!);
  }
  return out.slice(0, size);
}
