import { getSql } from "./db";
import type { AudioFeelAgg } from "./library";
import { getNoveltyIndex } from "./novelty";

/**
 * A four-letter, MBTI-style code summarising a listener on four orthogonal
 * axes derived from data we already have. The code is deterministic and
 * comparable across users — pairs well with the qualitative AI persona.
 *
 * Axes:
 *  M / N  Mainstream ↔ Niche       — average Deezer rank
 *  A / E  Acoustic ↔ Electronic    — audio-feel acousticness
 *  C / V  Calm ↔ Vigorous          — audio-feel energy
 *  F / X  Familiar ↔ eXploratory   — novelty index
 */
export interface MusicMBTI {
  code: string;
  axes: {
    mainstream: { value: number; letter: "M" | "N" }; // 0..1, higher = mainstream
    acoustic: { value: number; letter: "A" | "E" }; // 0..1, higher = acoustic
    calm: { value: number; letter: "C" | "V" }; // 0..1, higher = calm
    familiar: { value: number; letter: "F" | "X" }; // 0..1, higher = familiar
  };
}

/** Builds the MBTI code or returns null if data is too sparse. */
export async function getMusicMBTI(
  userId: string,
  audioFeel: AudioFeelAgg | null,
): Promise<MusicMBTI | null> {
  if (!audioFeel) return null;

  const sql = getSql();
  let avgRank: number | null = null;
  let nRank = 0;
  try {
    const r = await sql`
      SELECT avg(t.deezer_rank)::float AS avg_rank, count(*)::int AS n
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId} AND t.deezer_rank IS NOT NULL`;
    avgRank = r[0]?.avg_rank as number | null;
    nRank = (r[0]?.n as number) ?? 0;
  } catch {
    /* fall through */
  }
  if (avgRank == null || nRank < 10) return null;

  // Log-scaled mainstream-ness: avg_rank ~1k → 1.0, ~30k → 0.5, ~1M → 0.0.
  const mainstream = Math.max(
    0,
    Math.min(1, (6 - Math.log10(Math.max(1, avgRank))) / 3),
  );

  const novelty = await getNoveltyIndex(userId);
  const familiar = 1 - novelty.noveltyScore;
  const calm = 1 - audioFeel.energy;

  return {
    code:
      (mainstream >= 0.5 ? "M" : "N") +
      (audioFeel.acousticness >= 0.5 ? "A" : "E") +
      (calm >= 0.5 ? "C" : "V") +
      (familiar >= 0.5 ? "F" : "X"),
    axes: {
      mainstream: { value: mainstream, letter: mainstream >= 0.5 ? "M" : "N" },
      acoustic: {
        value: audioFeel.acousticness,
        letter: audioFeel.acousticness >= 0.5 ? "A" : "E",
      },
      calm: { value: calm, letter: calm >= 0.5 ? "C" : "V" },
      familiar: { value: familiar, letter: familiar >= 0.5 ? "F" : "X" },
    },
  };
}
