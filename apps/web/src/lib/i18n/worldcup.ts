import type { Locale } from "../i18n";

const en = {
  pageTitle: "World Cup",
  pageIntro:
    "Pit two tracks against each other and pick the winner. Survivors advance, the final champion is your one absolute favorite from the batch.",

  categoryTitle: "Pick a category",
  catLikedLabel: "From what I've liked",
  catLikedHint: "Your library, narrowed down to one absolute favorite.",
  catDiscoverLabel: "Taste discovery",
  catDiscoverHint: "Fresh recommendations head-to-head — meet your next obsession.",
  catMixLabel: "Mix",
  catMixHint: "Old favorites vs. new picks. Half library, half discovery.",
  catGenreLabel: "Find your favorite genre",
  catGenreHint: "Bracket of your genres — each card has sample tracks of yours.",
  catComingSoon: "Coming soon",

  sizeTitle: "Bracket size",
  sizeStart: "Start",
  sizeRoundCount: (rounds: number) => `${rounds} rounds`,

  notEnough: (have: number, need: number) =>
    `Need at least ${need} candidates for this size — you have ${have}. Try a smaller bracket or sync more songs.`,
  backToCategories: "← Categories",
};

const ko: typeof en = {
  pageTitle: "월드컵",
  pageIntro:
    "두 곡을 붙여 놓고 더 듣고 싶은 쪽을 고르세요. 이긴 곡은 다음 라운드로 진출하고, 마지막에 남은 우승곡이 이번 판의 절대 1픽.",

  categoryTitle: "카테고리 선택",
  catLikedLabel: "내가 들어본 노래 중",
  catLikedHint: "내 라이브러리에서 절대 1픽 가리기.",
  catDiscoverLabel: "취향 찾기",
  catDiscoverHint: "새 추천끼리 정면 비교 — 다음 빠질 곡을 발견.",
  catMixLabel: "섞기",
  catMixHint: "기존 좋아요 곡 vs 새 추천. 반반 섞어서.",
  catGenreLabel: "최애 장르 찾기",
  catGenreHint: "내 장르들 끼리 토너먼트 — 카드마다 본인 라이브러리 곡 샘플 노출.",
  catComingSoon: "곧 추가",

  sizeTitle: "토너먼트 크기",
  sizeStart: "시작",
  sizeRoundCount: (rounds: number) => `${rounds}라운드`,

  notEnough: (have: number, need: number) =>
    `이 크기로 진행하려면 최소 ${need}곡 필요 — 현재 ${have}곡. 더 작은 크기를 고르거나 좋아요를 더 sync 하세요.`,
  backToCategories: "← 카테고리로",
};

export function worldcupDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
