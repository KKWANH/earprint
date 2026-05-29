import type { Locale } from "@/lib/i18n";

const en = {
  // /u — creator search
  community: "Community",
  findCreator: "Find a creator",
  findCreatorBody: "Search worldcup creators by their handle.",
  searchPlaceholder: "Search handle…",
  search: "Search",
  matchesFor: (q: string, n: number) =>
    `${n} match${n === 1 ? "" : "es"} for "${q}"`,
  topCreators: "Top 30 creators",
  noMatches: "No matches.",
  noCreators: "No creators yet.",
  creatorMeta: (worldcups: number, plays: number) =>
    `${worldcups} worldcups · ${plays.toLocaleString()} plays`,

  // /u/[handle] — profile
  communityBack: "← Community",
  worldcupCreator: "Worldcup creator",
  profileMeta: (worldcups: number, plays: number) =>
    `${worldcups} worldcups · ${plays.toLocaleString()} total plays`,
  viewTaste: "🎧 View their taste",
  compareWithMine: "↔ Compare with mine",
  slotSuffix: "-slot",
  playsSuffix: " plays",
  viewStats: "📊 View detailed stats →",
  showingFirst60: "Showing the first 60 worldcups.",
  sparklineAria: (plays: number) => `last 14 days ${plays.toLocaleString()} plays`,
  last14Days: "Last 14 days",

  // /u/[handle]/stats
  statsWord: "stats",
  totalPlays: "Total plays",
  totalChampions: "Total champions crowned",
  monthlyPlays: "Monthly plays (12 months)",
  hallOfFame: "👑 Hall of Fame",
  perWorldcup: "Per-worldcup",
};

const ko: typeof en = {
  community: "커뮤니티",
  findCreator: "메이커 찾기",
  findCreatorBody: "월드컵을 만든 사람을 핸들로 검색하세요.",
  searchPlaceholder: "핸들 검색…",
  search: "검색",
  matchesFor: (q, n) => `"${q}" 검색 결과 ${n}명`,
  topCreators: "인기 메이커 TOP 30",
  noMatches: "검색 결과 없음.",
  noCreators: "아직 메이커가 없어요.",
  creatorMeta: (worldcups, plays) =>
    `${worldcups}개 월드컵 · ${plays.toLocaleString()}회 진행`,

  communityBack: "← 커뮤니티",
  worldcupCreator: "Worldcup 메이커",
  profileMeta: (worldcups, plays) =>
    `${worldcups}개 월드컵 · 총 ${plays.toLocaleString()}회 진행`,
  viewTaste: "🎧 취향 보기",
  compareWithMine: "↔ 내 취향과 비교",
  slotSuffix: "강",
  playsSuffix: "회",
  viewStats: "📊 상세 통계 보기 →",
  showingFirst60: "60개까지만 표시됩니다.",
  sparklineAria: (plays) => `최근 14일 플레이 ${plays.toLocaleString()}회`,
  last14Days: "최근 14일",

  statsWord: "통계",
  totalPlays: "총 진행",
  totalChampions: "총 우승 횟수",
  monthlyPlays: "월별 진행 (12개월)",
  hallOfFame: "👑 우승 명예의 전당",
  perWorldcup: "월드컵별 통계",
};

export function creatorDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
