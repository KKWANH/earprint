/**
 * Deezer search — free, no auth. One call per track.
 * Yields album, preview and a match-confidence score.
 * (BPM and genre are skipped — Deezer's data quality for them is poor.)
 */
import { getJson } from "./http";

const API = "https://api.deezer.com";

export interface DeezerMatch {
  deezerId: number | null;
  album: string | null;
  coverUrl: string | null;
  previewUrl: string | null;
  matchConfidence: number;
}

const EMPTY: DeezerMatch = {
  deezerId: null,
  album: null,
  coverUrl: null,
  previewUrl: null,
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

export async function searchDeezer(artist: string, title: string): Promise<DeezerMatch> {
  const cleanTitle = norm(title) || title;
  const advanced = `artist:"${artist.replace(/"/g, "")}" track:"${cleanTitle}"`;

  let data = await getJson(`${API}/search?q=${encodeURIComponent(advanced)}&limit=1`);
  let hit = data?.data?.[0];
  if (!hit) {
    data = await getJson(`${API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`);
    hit = data?.data?.[0];
  }
  if (!hit) return EMPTY;

  return {
    deezerId: hit.id ?? null,
    album: hit.album?.title ?? null,
    coverUrl: hit.album?.cover_big || hit.album?.cover_medium || null,
    previewUrl: hit.preview || null,
    matchConfidence: scoreMatch(title, hit.title ?? ""),
  };
}
