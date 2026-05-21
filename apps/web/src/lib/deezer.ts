/**
 * Deezer search — free, no auth. One search call per track, plus one track
 * lookup for the release year (used by the reminiscence-bump analysis).
 * Yields album, preview, popularity rank, release year and a match score.
 */
import { getJson } from "./http";

const API = "https://api.deezer.com";

export interface DeezerMatch {
  deezerId: number | null;
  album: string | null;
  coverUrl: string | null;
  previewUrl: string | null;
  releaseYear: number | null;
  rank: number | null; // Deezer popularity (higher = more mainstream)
  matchConfidence: number;
}

const EMPTY: DeezerMatch = {
  deezerId: null,
  album: null,
  coverUrl: null,
  previewUrl: null,
  releaseYear: null,
  rank: null,
  matchConfidence: 0,
};

/** Normalize for matching/scoring: lowercase, strip brackets/feat/symbols (keep CJK). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\bfeat\.?.*$/i, " ")
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/gi, " ")
    .trim();
}

function scoreMatch(a: string, b: string): number {
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

  return {
    deezerId: hit.id ?? null,
    album: hit.album?.title ?? null,
    coverUrl: hit.album?.cover_big || hit.album?.cover_medium || null,
    previewUrl: hit.preview || null,
    releaseYear,
    rank: typeof hit.rank === "number" ? hit.rank : null,
    matchConfidence: scoreMatch(title, hit.title ?? ""),
  };
}
