import { searchDeezer } from "./deezer";

/** One input row for save_enrichments(). */
export interface EnrichmentRow {
  deezerId: number | null;
  album: string | null;
  previewUrl: string | null;
  bpm: number | null;
  genres: Record<string, number> | null;
  moods: Record<string, number> | null;
  matchConfidence: number;
}

/**
 * Phase 1 enrichment for a single track — Deezer only (album, preview, match).
 * Genres/moods are left to the AI phase (Gemini), which is album-aware and
 * more accurate; Last.fm's artist-level tags were too coarse and slow.
 */
export async function enrichTrack(artist: string, title: string): Promise<EnrichmentRow> {
  const deezer = await searchDeezer(artist, title);
  return {
    deezerId: deezer.deezerId,
    album: deezer.album,
    previewUrl: deezer.previewUrl,
    bpm: null,
    genres: null,
    moods: null,
    matchConfidence: deezer.matchConfidence,
  };
}
