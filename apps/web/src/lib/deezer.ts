/**
 * Deezer search — free, no auth. One search call per track, plus one track
 * lookup for the release year (used by the reminiscence-bump analysis).
 * Yields album, preview, popularity rank, release year and a match score.
 */
import { getSql } from "./db";
import { getJson } from "./http";

const API = "https://api.deezer.com";

export interface DeezerMatch {
  deezerId: number | null;
  /** Deezer's artist ID — shared across every track by that artist regardless
   *  of how the source platform spelled the name. Powers KO↔EN auto-dedup. */
  artistId: number | null;
  /** Deezer's canonical artist name (e.g. "BTS" even if we searched "방탄소년단"). */
  artistName: string | null;
  album: string | null;
  coverUrl: string | null;
  previewUrl: string | null;
  releaseYear: number | null;
  rank: number | null; // Deezer popularity (higher = more mainstream)
  matchConfidence: number;
}

const EMPTY: DeezerMatch = {
  deezerId: null,
  artistId: null,
  artistName: null,
  album: null,
  coverUrl: null,
  previewUrl: null,
  releaseYear: null,
  rank: null,
  matchConfidence: 0,
};

/** Normalize for matching/scoring: lowercase, strip brackets/feat/symbols (keep CJK).
 *  Exported for unit testing (R37) — also used internally. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\bfeat\.?.*$/i, " ")
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/gi, " ")
    .trim();
}

/** Title/artist similarity 0.4–0.95. Exported for unit testing (R37). */
export function scoreMatch(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0.4;
  if (x === y) return 0.95;
  if (x.includes(y) || y.includes(x)) return 0.75;
  return 0.5;
}

/** Parses a 4-digit year out of a Deezer release_date ("YYYY-MM-DD"). */
function yearOf(date: unknown): number | null {
  const m = typeof date === "string" ? date.match(/^(\d{4})/) : null;
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= new Date().getFullYear() + 1 ? y : null;
}

export async function searchDeezer(
  artist: string,
  title: string,
  opts: { withYear?: boolean } = {},
): Promise<DeezerMatch> {
  const withYear = opts.withYear ?? true;
  const cacheKey = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
  const sql = getSql();

  // Cached match — avoids a repeat Deezer call (faster, fewer rate limits).
  try {
    const hitRow = await sql`SELECT payload FROM deezer_match WHERE cache_key = ${cacheKey}`;
    if (hitRow.length > 0) return hitRow[0].payload as DeezerMatch;
  } catch {
    /* fall through to a live lookup */
  }

  const cleanTitle = norm(title) || title;
  const advanced = `artist:"${artist.replace(/"/g, "")}" track:"${cleanTitle}"`;

  let data = await getJson(`${API}/search?q=${encodeURIComponent(advanced)}&limit=1`);
  let hit = data?.data?.[0];
  if (!hit) {
    data = await getJson(`${API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`);
    hit = data?.data?.[0];
  }
  if (!hit) return EMPTY;

  // The search result carries rank but not a release date — one extra
  // lookup gets the original year (skipped when the caller doesn't need it).
  let releaseYear: number | null = null;
  if (withYear && hit.id) {
    try {
      const track = await getJson(`${API}/track/${hit.id}`);
      releaseYear = yearOf(track?.release_date) ?? yearOf(track?.album?.release_date);
    } catch {
      /* year stays null */
    }
  }

  // Confidence has to weight BOTH title AND artist. The previous
  // title-only score was unsafe for music: many songs share titles
  // (covers, identical-name tracks across decades), and the YouTube
  // Music artist string we send in can drift from Deezer's canonical
  // ("BTS" vs "방탄소년단" vs "BTS (방탄소년단)" vs "Topic" channels).
  // Title carries slightly more weight than artist because translit /
  // alias mismatches on artist are common even for genuine matches.
  // Album would tighten this further but isn't in the search-input
  // contract today; threaded in a follow-up.
  const titleScore = scoreMatch(title, (hit.title as string | undefined) ?? "");
  const artistScore = scoreMatch(
    artist,
    (hit.artist?.name as string | undefined) ?? "",
  );
  const matchConfidence = titleScore * 0.55 + artistScore * 0.45;

  // Below this floor we don't trust the match enough to surface its
  // popularity / release year / preview as if they describe the user's
  // actual track. Keep the basic identifiers (deezerId, artist, album,
  // cover) since those just locate the candidate — but suppress the
  // year + rank + preview, which downstream features read as ground
  // truth (reminiscence-bump uses year, recommend popularity uses rank,
  // preview powers the play button). A bad year would silently shift
  // the listener's "nostalgia window" to the wrong decade.
  const HIGH_CONFIDENCE = 0.65;
  const isStrongMatch = matchConfidence >= HIGH_CONFIDENCE;

  const result: DeezerMatch = {
    deezerId: hit.id ?? null,
    artistId: typeof hit.artist?.id === "number" ? hit.artist.id : null,
    artistName: typeof hit.artist?.name === "string" ? hit.artist.name : null,
    album: hit.album?.title ?? null,
    coverUrl: hit.album?.cover_big || hit.album?.cover_medium || null,
    previewUrl: isStrongMatch ? hit.preview || null : null,
    releaseYear: isStrongMatch ? releaseYear : null,
    rank: isStrongMatch && typeof hit.rank === "number" ? hit.rank : null,
    matchConfidence,
  };
  // Cache both hits and misses. Without caching the EMPTY result, tracks
  // Deezer can't match get re-searched on every batch — wasting subrequests
  // and (on Workers free plan) tripping the 50-subreq cap on the same 14
  // dead-end tracks forever.
  try {
    await sql`
      INSERT INTO deezer_match (cache_key, payload)
      VALUES (${cacheKey}, ${JSON.stringify(result)}::jsonb)
      ON CONFLICT (cache_key) DO NOTHING`;
  } catch {
    /* caching is best-effort */
  }
  return result;
}
