/**
 * Candidate fetchers for the /worldcup bracket page.
 *
 * Each category produces a `BracketCandidate[]` shaped exactly like the
 * one in `app/worldcup/Bracket.tsx`. The bracket doesn't care which
 * source they came from — it just runs pairs to a champion. Sources:
 *
 *   • liked     — user's library, top N by recency-weighted likes
 *   • discover  — recommendations table, top N by score
 *   • mix       — interleaved 50/50 of the two
 *
 * "최애 장르" (favorite genre) has a different card UI (genre name +
 * sample tracks instead of cover/artist/title), so it lives in its own
 * runner at /worldcup/genre/[size]/page.tsx and uses getGenreCandidates
 * directly. `getCandidates("genre", …)` returns [] for that reason —
 * if you ever route a genre request through the generic dispatcher
 * you'll get an empty bracket, by design.
 */

import { getSql } from "./db";

export type WorldcupCategory = "liked" | "discover" | "mix" | "genre";

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
    case "liked":   return getLikedCandidates(userId, size);
    case "discover": return getDiscoverCandidates(userId, size);
    case "mix":     return getMixedCandidates(userId, size);
    case "genre":   return []; // Genre uses its own runner — call getGenreCandidates directly
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

/** Top-N liked tracks by recency-weighted score. Caps at the requested
 *  bracket size; smaller libraries return everything they have. */
async function getLikedCandidates(
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
    coverUrl: null, // tracks table doesn't carry a cover; Deezer fills it lazily on the card
    deezerId: (r.deezer_id as number) ?? null,
    score: (r.score as number) ?? null,
    recType: "liked",
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

/** 50/50 mix of liked + discover, interleaved so the bracket's first
 *  round naturally pits "old favorite vs. new pick". */
async function getMixedCandidates(
  userId: string,
  size: number,
): Promise<BracketCandidate[]> {
  const half = Math.ceil(size / 2);
  const [liked, discover] = await Promise.all([
    getLikedCandidates(userId, half),
    getDiscoverCandidates(userId, half),
  ]);
  const out: BracketCandidate[] = [];
  for (let i = 0; i < half; i++) {
    if (liked[i]) out.push(liked[i]!);
    if (discover[i]) out.push(discover[i]!);
  }
  return out.slice(0, size);
}
