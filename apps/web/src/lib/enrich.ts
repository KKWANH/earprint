import { searchDeezer } from "./deezer";
import { getLastfmTags } from "./lastfm";

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
 * Enriches a single track — calls Deezer (album, preview) + Last.fm (genres, moods) in parallel.
 * BPM is low priority and not collected here (handled in Phase 3 MIR).
 */
export async function enrichTrack(artist: string, title: string): Promise<EnrichmentRow> {
  const [deezer, tags] = await Promise.all([
    searchDeezer(artist, title),
    getLastfmTags(artist, title),
  ]);

  return {
    deezerId: deezer.deezerId,
    album: deezer.album,
    previewUrl: deezer.previewUrl,
    bpm: null,
    genres: tags.genres,
    moods: tags.moods,
    matchConfidence: deezer.matchConfidence,
  };
}
