import type { Locale } from "../i18n";

const en = {
  pageTitle: "World Cup",
  pageIntro:
    "Pit two tracks against each other and pick the winner. Survivors advance, the final champion is your one absolute favorite from the batch. Pick a mode that frames the question you actually want to answer.",

  categoryTitle: "Pick a category",

  // Self-bracket modes — the product purpose. `library` is the headline.
  catLibraryLabel: "Random from my library",
  catLibraryHint:
    "Uniform-random sample from your WHOLE library — every corner of your taste gets a fair shot. Reshuffles every visit.",
  catRecentLabel: "What I'm into lately",
  catRecentHint:
    "Top picks by recency. Best for ranking the last few months of likes against each other.",
  catForgottenLabel: "Forgotten gems",
  catForgottenHint:
    "Random sample from the older half of your library — rediscover songs you haven't surfaced in a while.",

  // Genre keeps its own runner + card UI.
  catGenreLabel: "Find your favorite genre",
  catGenreHint: "Bracket of your genres — each card has sample tracks of yours.",

  // vs-the-world modes — still here but ranked below self-bracket.
  catDiscoverLabel: "Taste discovery",
  catDiscoverHint: "Fresh recommendations head-to-head — meet your next obsession.",
  catMixLabel: "Mix",
  catMixHint: "Old favorites vs. new picks. Half library, half discovery.",

  // Legacy — kept for the alias label fallback; never rendered in the picker.
  catLikedLabel: "From what I've liked",
  catLikedHint: "Your library, narrowed down to one absolute favorite.",

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
    "두 곡을 붙여 놓고 더 듣고 싶은 쪽을 고르세요. 이긴 곡은 다음 라운드로 진출하고, 마지막에 남은 우승곡이 이번 판의 절대 1픽. 진짜 답하고 싶은 질문에 맞는 모드를 고르세요.",

  categoryTitle: "카테고리 선택",

  catLibraryLabel: "내 라이브러리 전체에서 랜덤",
  catLibraryHint:
    "전체 라이브러리에서 균등 랜덤 추출 — 취향의 모든 구석이 공평하게 등장. 방문할 때마다 셔플됩니다.",
  catRecentLabel: "요즘 빠진 곡",
  catRecentHint:
    "최근 좋아요 기준 상위 곡. 지난 몇 달의 좋아요를 서로 줄세울 때 적합.",
  catForgottenLabel: "잊고 있던 명곡",
  catForgottenHint:
    "라이브러리 오래된 절반에서 랜덤 추출 — 한동안 안 떴던 곡을 다시 만납니다.",

  catGenreLabel: "최애 장르 찾기",
  catGenreHint: "내 장르들 끼리 토너먼트 — 카드마다 본인 라이브러리 곡 샘플 노출.",

  catDiscoverLabel: "취향 찾기",
  catDiscoverHint: "새 추천끼리 정면 비교 — 다음 빠질 곡을 발견.",
  catMixLabel: "섞기",
  catMixHint: "라이브러리 곡 vs 새 추천. 반반 섞어서.",

  catLikedLabel: "내가 들어본 노래 중",
  catLikedHint: "내 라이브러리에서 절대 1픽 가리기.",

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
