import { getSql } from "./db";
import { getExcludedArtists } from "./library";

/**
 * Reminiscence-bump ("imprint core") analysis.
 *
 * Music heard at ~15–25 years old (emotional peak ≈ 17) is encoded with
 * unusually strong, hormone-laden memory traces during adolescent brain
 * development, and keeps a lasting grip on taste. This module locates that
 * formative window inside the user's library by release year.
 *   — Frontiers in Psychology (2024); Rentfrow, Cambridge "musical ages".
 */

export interface YearBar {
  year: number;
  count: number;
  inWindow: boolean; // falls inside the 15–25 imprint window
}

export interface ImprintAnalysis {
  birthYear: number | null;
  hasYearData: boolean;
  totalWithYear: number;
  coverage: number; // share of liked tracks that have a release year
  histogram: YearBar[];
  window: { start: number; end: number } | null; // calendar years of age 15–25
  imprintCount: number;
  imprintShare: number; // 0..1 — share of dated library inside the window
  recentCount: number; // released in the last 3 calendar years
  recentShare: number;
  medianYear: number | null; // taste's centre of gravity
  medianAge: number | null; // user's age when the median song came out
  peakYear: number | null; // single year with the most likes
  stage: "digging" | "imprint" | "balanced" | "unknown";
}

const IMPRINT_START_AGE = 15;
const IMPRINT_END_AGE = 25;

export async function getImprintAnalysis(userId: string): Promise<ImprintAnalysis> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);

  const [userRow, yearRows, totalRow] = await Promise.all([
    sql`SELECT birth_year FROM users WHERE id = ${userId}`,
    sql`
      SELECT t.release_year AS year, count(*)::int AS count
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId}
        AND t.release_year > 0
        AND t.artist <> ALL(${excluded}::text[])
      GROUP BY t.release_year
      ORDER BY t.release_year`,
    sql`
      SELECT count(*)::int AS total
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])`,
  ]);

  const birthYear = (userRow[0]?.birth_year as number | null) ?? null;
  const totalLikes = (totalRow[0]?.total as number) ?? 0;
  const totalWithYear = yearRows.reduce((s, r) => s + (r.count as number), 0);
  const thisYear = new Date().getFullYear();

  const window =
    birthYear != null
      ? { start: birthYear + IMPRINT_START_AGE, end: birthYear + IMPRINT_END_AGE }
      : null;

  const histogram: YearBar[] = yearRows.map((r) => {
    const year = r.year as number;
    return {
      year,
      count: r.count as number,
      inWindow: window != null && year >= window.start && year <= window.end,
    };
  });

  // Median release year — the cumulative-count crossing of the halfway point.
  let medianYear: number | null = null;
  if (totalWithYear > 0) {
    let cum = 0;
    for (const b of histogram) {
      cum += b.count;
      if (cum >= totalWithYear / 2) {
        medianYear = b.year;
        break;
      }
    }
  }

  const imprintCount = histogram
    .filter((b) => b.inWindow)
    .reduce((s, b) => s + b.count, 0);
  const recentCount = histogram
    .filter((b) => b.year >= thisYear - 2)
    .reduce((s, b) => s + b.count, 0);
  const peak = histogram.reduce<YearBar | null>(
    (best, b) => (best == null || b.count > best.count ? b : best),
    null,
  );

  const imprintShare = totalWithYear > 0 ? imprintCount / totalWithYear : 0;
  const recentShare = totalWithYear > 0 ? recentCount / totalWithYear : 0;

  let stage: ImprintAnalysis["stage"] = "unknown";
  if (totalWithYear >= 30) {
    if (recentShare >= 0.3 && recentShare >= imprintShare) stage = "digging";
    else if (imprintShare >= 0.3) stage = "imprint";
    else stage = "balanced";
  }

  return {
    birthYear,
    hasYearData: totalWithYear > 0,
    totalWithYear,
    coverage: totalLikes > 0 ? totalWithYear / totalLikes : 0,
    histogram,
    window,
    imprintCount,
    imprintShare,
    recentCount,
    recentShare,
    medianYear,
    medianAge: medianYear != null && birthYear != null ? medianYear - birthYear : null,
    peakYear: peak?.year ?? null,
    stage,
  };
}
