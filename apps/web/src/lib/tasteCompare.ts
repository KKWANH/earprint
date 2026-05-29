/**
 * Pure taste-overlap math (R38). No DB / network — the caller loads
 * two users' library aggregates and hands them in, so this is fully
 * unit-testable and reusable (compare page, future "people like you"
 * surfacing, etc.).
 *
 * Inputs are the same `Count[]` shapes getLibraryStats already
 * returns (top genres / artists / families) plus the audio-feel
 * averages. We deliberately use TOP-N set overlap rather than full
 * weighted cosine because (a) the tails are noisy AI tags and (b)
 * "we both love these 5 artists" is the intuition a user wants, not
 * a cosine number.
 */

export interface TasteVector {
  /** Lowercased genre name → already-canonical is fine; we lowercase
   *  again defensively so callers don't have to. */
  genres: { name: string; count: number }[];
  artists: { name: string; count: number }[];
  audioFeel: { energy: number; tempo: number; acousticness: number } | null;
}

export interface TasteOverlap {
  /** 0..1 blended similarity. */
  score: number;
  /** Genre names present in BOTH top sets (canonical-lowercased). */
  sharedGenres: string[];
  /** Artist names present in BOTH top sets. */
  sharedArtists: string[];
  genreJaccard: number;
  artistJaccard: number;
  /** 0..1 audio-feel closeness (1 = identical feel). null when either
   *  side has no audio-feel data. */
  feelSimilarity: number | null;
  /** Human bucket for the headline. */
  tier: "twin" | "close" | "some" | "distant";
}

/** Set intersection / union (Jaccard) over the first `topN` names. */
function jaccard(
  a: { name: string }[],
  b: { name: string }[],
  topN: number,
): { score: number; shared: string[] } {
  const setA = new Set(a.slice(0, topN).map((x) => x.name.toLowerCase().trim()));
  const setB = new Set(b.slice(0, topN).map((x) => x.name.toLowerCase().trim()));
  if (setA.size === 0 || setB.size === 0) return { score: 0, shared: [] };
  const shared: string[] = [];
  for (const x of setA) if (setB.has(x)) shared.push(x);
  const union = new Set([...setA, ...setB]).size;
  return { score: union === 0 ? 0 : shared.length / union, shared };
}

/** Audio-feel similarity: 1 − normalized euclidean distance across the
 *  three 0..1 axes. Returns null when either feel is missing. */
function feelSim(
  a: TasteVector["audioFeel"],
  b: TasteVector["audioFeel"],
): number | null {
  if (!a || !b) return null;
  const d = Math.sqrt(
    (a.energy - b.energy) ** 2 +
      (a.tempo - b.tempo) ** 2 +
      (a.acousticness - b.acousticness) ** 2,
  );
  // Max possible distance across 3 axes each in [0,1] is sqrt(3).
  const norm = d / Math.sqrt(3);
  return Math.max(0, Math.min(1, 1 - norm));
}

const TOP_N = 15;

export function compareTaste(a: TasteVector, b: TasteVector): TasteOverlap {
  const g = jaccard(a.genres, b.genres, TOP_N);
  const ar = jaccard(a.artists, b.artists, TOP_N);
  const fs = feelSim(a.audioFeel, b.audioFeel);

  // Blend. Artists are the strongest taste signal (sharing 5 artists
  // means a lot more than sharing "pop"), so weight them highest.
  // Audio feel is a soft tiebreaker; when absent we renormalize.
  const parts: { w: number; v: number }[] = [
    { w: 0.5, v: ar.score },
    { w: 0.35, v: g.score },
  ];
  if (fs != null) parts.push({ w: 0.15, v: fs });
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  const score = parts.reduce((s, p) => s + p.w * p.v, 0) / totalW;

  const tier: TasteOverlap["tier"] =
    score >= 0.5 ? "twin" : score >= 0.25 ? "close" : score >= 0.08 ? "some" : "distant";

  return {
    score,
    sharedGenres: g.shared,
    sharedArtists: ar.shared,
    genreJaccard: g.score,
    artistJaccard: ar.score,
    feelSimilarity: fs,
    tier,
  };
}
