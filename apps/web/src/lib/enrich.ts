import { searchDeezer } from "./deezer";
import { getLastfmTags } from "./lastfm";

/** save_enrichments() 입력 한 행. */
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
 * 트랙 1곡 보강 — Deezer(앨범·미리듣기) + Last.fm(장르·무드)를 병렬 호출.
 * BPM 은 우선순위가 낮아 수집하지 않는다 (Phase 3 MIR 에서).
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
