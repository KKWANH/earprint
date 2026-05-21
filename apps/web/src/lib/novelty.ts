import { getSql } from "./db";
import { getExcludedArtists } from "./library";

/**
 * Prediction & novelty index.
 *
 * Musical pleasure peaks at the sweet spot between predictability and
 * surprise — the brain rewards a prediction that is *almost* right or
 * pleasantly wrong (Huron, "Sweet Anticipation"; Gold et al., J. Neurosci
 * 2019; Salimpoor et al., Nature Neuroscience 2011). A refined listener's
 * prediction model is sharper, so the same cliché feels duller and they
 * drift toward more novel material.
 *
 * This module places the library on a familiarity ↔ novelty axis from three
 * signals: genre variety (entropy), sub-genre specificity, and how far the
 * picks sit from the mainstream (Deezer popularity rank).
 */

export interface NoveltyComponent {
  key: string;
  label: string;
  value: number; // 0..1
  hint: string;
}

export interface NoveltyIndex {
  analyzed: number; // tracks with genre data
  rankCoverage: number; // tracks with a popularity rank
  distinctGenres: number;
  topGenre: { name: string; share: number } | null;
  variety: number; // 0..1 — normalized genre entropy
  specificity: number; // 0..1 — sub-genre depth
  obscurity: number; // 0..1 — distance from the mainstream
  noveltyScore: number; // 0..1 — familiarity(0) ↔ novelty(1)
  components: NoveltyComponent[];
  verdict: string;
}

// Broad umbrella genres — everything else counts as a specific sub-genre.
const BROAD = new Set([
  "pop", "rock", "hip hop", "hip-hop", "hiphop", "rap", "k-pop", "kpop", "k pop",
  "dance", "electronic", "edm", "indie", "alternative", "r&b", "rnb", "jazz",
  "classical", "metal", "folk", "country", "soul", "funk", "ballad", "house",
  "music", "ost", "soundtrack", "world", "acoustic", "trot", "발라드", "댄스",
]);

const MAINSTREAM_RANK = 700_000; // Deezer rank at/above which a track is a hit

export async function getNoveltyIndex(userId: string): Promise<NoveltyIndex> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);

  const [genreRows, analyzedRow, rankRows] = await Promise.all([
    sql`
      SELECT k.key AS genre, count(*)::int AS count
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      JOIN tracks t ON t.id = a.track_id
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
        AND t.artist <> ALL(${excluded}::text[])
      GROUP BY k.key`,
    sql`
      SELECT count(*)::int AS analyzed
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      JOIN tracks t ON t.id = a.track_id
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
        AND t.artist <> ALL(${excluded}::text[])`,
    sql`
      SELECT t.deezer_rank::float AS rank
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId} AND t.deezer_rank IS NOT NULL
        AND t.artist <> ALL(${excluded}::text[])
      ORDER BY t.deezer_rank`,
  ]);

  const genres = genreRows.map((r) => ({
    name: r.genre as string,
    count: r.count as number,
  }));
  const total = genres.reduce((s, g) => s + g.count, 0);
  const analyzed = (analyzedRow[0]?.analyzed as number) ?? 0;

  // Genre variety — Shannon entropy, normalized against a rich library.
  let entropy = 0;
  for (const g of genres) {
    const p = g.count / total;
    if (p > 0) entropy -= p * Math.log(p);
  }
  const variety = total > 0 ? Math.min(1, entropy / Math.log(35)) : 0;

  // Sub-genre specificity — share of tags that are not broad umbrellas.
  const specificCount = genres
    .filter((g) => !BROAD.has(g.name.toLowerCase().trim()))
    .reduce((s, g) => s + g.count, 0);
  const specificity = total > 0 ? specificCount / total : 0;

  // Obscurity — median popularity rank, far below a hit ⇒ more novel.
  let obscurity = 0;
  const ranks = rankRows.map((r) => r.rank as number);
  if (ranks.length > 0) {
    const median = ranks[Math.floor(ranks.length / 2)];
    obscurity = Math.max(0, Math.min(1, 1 - median / MAINSTREAM_RANK));
  }

  const sorted = [...genres].sort((a, b) => b.count - a.count);
  const topGenre =
    sorted.length > 0 && total > 0
      ? { name: sorted[0].name, share: sorted[0].count / total }
      : null;

  const noveltyScore = 0.4 * variety + 0.3 * specificity + 0.3 * obscurity;

  let verdict: string;
  if (analyzed < 20) {
    verdict = "분석된 곡이 적어 아직 정확하지 않습니다. 곡 분석을 더 돌려주세요.";
  } else if (noveltyScore < 0.34) {
    verdict =
      "익숙함 추구형 — 검증되고 친숙한 사운드를 선호합니다. 뇌의 예측이 잘 맞아떨어지는 안정적인 쾌감이지만, 가끔의 낯선 자극이 더 큰 보상을 줄 수 있습니다.";
  } else if (noveltyScore < 0.62) {
    verdict =
      "스위트 스폿 — 익숙한 틀 안에서 신선한 자극을 즐기는 균형형입니다. 연구가 말하는 '예측가능성 × 불확실성'의 보상 정점에 가장 가까운 취향입니다.";
  } else {
    verdict =
      "신선함 추구형 — 낯선 사운드와 깊은 디깅을 즐깁니다. 예측 모델이 정교해 뻔한 전개로는 쉽게 만족하지 않는, 이른바 '음잘알'의 패턴입니다.";
  }

  return {
    analyzed,
    rankCoverage: ranks.length,
    distinctGenres: genres.length,
    topGenre,
    variety,
    specificity,
    obscurity,
    noveltyScore,
    components: [
      {
        key: "variety",
        label: "장르 다양성",
        value: variety,
        hint: "얼마나 폭넓은 장르를 듣는가 (엔트로피)",
      },
      {
        key: "specificity",
        label: "하위장르 구체성",
        value: specificity,
        hint: "'팝·록' 같은 큰 분류 대신 세분된 하위장르의 비중",
      },
      {
        key: "obscurity",
        label: "비주류성",
        value: obscurity,
        hint: "대중적 히트곡에서 얼마나 떨어진 선택인가 (Deezer 인기순위)",
      },
    ],
    verdict,
  };
}
