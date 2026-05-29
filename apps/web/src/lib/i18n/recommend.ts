import type { Locale } from "../i18n";

const en = {
  loginGoogle: "Sign in with Google",
  pageTitle: "Recommendations",
  pageIntro:
    "Listen and rate. Liked tracks land in your library; passes drop the artist from future picks. Want a bracket-style vote-off instead? → /worldcup",

  // HEADER labels (why-recommended strip). Each one is the user-facing
  // "why this is on your screen" answer for the recType the recommender
  // assigned — not a feature name. Read them as the sentence the card
  // is making to the user.
  headerSong: "Close to a song you love",
  headerGenre: "From your core genres",
  headerUnheard: "Outside your usual taste — try something new",
  headerIndie: "Under-the-radar artist — hidden gem",
  /** Renders the seedTrack chip on the right side of the strip with a
   *  short connective so it reads naturally with whichever header label
   *  is showing ("Close to a song you love · via Bohemian Rhapsody"). */
  headerSeedPrefix: "via",

  // empty state
  emptyNoRecs: "No recommendations to rate.",
  generating: "Generating… (~10s)",
  generate: "Generate recommendations",

  // counts
  countsRated: "Rated",

  // swipe hint
  swipeHint: "Swipe / arrow keys · ← Pass · → Like · ↑ Love it · Space to play",

  // rate button titles
  rateStrongDislike: "Really bad",
  rateDislike: "Pass",
  ratePass: "Skip",
  rateLike: "Like",
  rateSuperlike: "Love it",

  // controls
  known: "Already know it",
  undo: "↩ Undo",

  // rollback toast — shown when /api/recommend/rate fails so the user knows
  // the rating wasn't actually saved (we revert the optimistic UI).
  ratingFailed: "Rating wasn't saved — check your connection and try again.",
  undoFailed: "Couldn't undo on the server — try again.",
  dismiss: "Dismiss",

  // comment textarea
  commentPlaceholder: "A note about this song (optional) — saved with your rating",

  // ModePicker
  modePickerTitle: "Choose a recommendation style",
  modeMakingShort: "Generating… (~10s)",
  modeNoNew: "No new picks found for that style — try another one.",
  modePickerHint:
    "A fresh batch of recommendations is generated in the chosen style. Songs you rated (likes / already known) are added to your library.",

  // MODES labels + hints
  modeMixLabel: "Mixed",
  modeMixHint: "A blend of different methods",
  modeSongLabel: "Song-based",
  modeSongHint: "Songs similar to ones you love",
  modeGenreLabel: "Genre-based",
  modeGenreHint: "Standout tracks from your core genres",
  modeUnheardLabel: "Unheard genres",
  modeUnheardHint: "New genres outside your taste",
  modeIndieLabel: "Hidden gems",
  modeIndieHint: "Great tracks below the big listener counts",

  // Mode toggle between swipe (Tinder) and bracket (이상형월드컵) layouts
  layoutToggleSwipe: "Swipe",
  layoutToggleBracket: "Tournament",
  bracketHint: "Pick the one you'd rather hear. Winners advance through the rounds; the champion is your superlike.",
  bracketSkipBoth: "Skip both",
  bracketWatchYt: "Watch on YouTube ↗",
  bracketEmpty: "Not enough new recs for a tournament. Generate a fresh batch?",
  bracketNeedMore: (have: number, need: number): string =>
    `Need ${need} recs for a tournament — have ${have}. Generate more?`,
  bracketRound: (round: number, totalRounds: number): string => {
    const remaining = totalRounds - round;
    if (remaining <= 1) return "Final";
    if (remaining === 2) return "Semi-final";
    if (remaining === 3) return "Quarter-final";
    return `Round of ${2 ** remaining}`;
  },
  bracketPairOf: (idx: number, of: number): string => `Pair ${idx} of ${of}`,
  bracketChampionTitle: "🏆 Your champion",
  bracketChampionSub: "Rated as a superlike. The runners-up got likes; first-round losers were passed.",
  bracketRestart: "New tournament",
  bracketPatternTitle: "Match-up style",
  bracketPatternRandom: "🎲 Random",
  bracketPatternFavorites: "❤️ Top picks first",
  bracketPatternOpposites: "⚡ Opposites",
  bracketPatternCross: "🔀 Mixed modes",
  bracketPatternHint:
    "Random shuffles freely. Top picks pairs your highest-scoring recs against each other. Opposites pits the most against the least similar (high vs low scores). Mixed modes interleaves song-based with unheard-genre picks.",
  bracketKeyboardHint: "← left · → right · Space play",
  bracketFinalBanner: "🏆 FINAL — pick your winner",

  // R40 — auto-pick / mode-accuracy panel strings (migrated from inline ternaries)
  // EC-5 "rate a few to unlock" nudge (interpolated)
  autoPickUnlockHint: (totalRated: number, need: number) =>
    `Rate 5+ in one mode to unlock "auto-pick" (${totalRated} so far). ~${need} more in the same mode.`,
  autoPickLabel: (mode: string, pct: number) => `Auto-pick: ${mode} (${pct}% liked)`,
  autoPickBasis: (n: number) => `Based on ${n} recent ratings`,
  autoPickUse: "Use this mode",
  modeAccuracyTitle: "🎯 Mode accuracy",
  modeAccuracySummary: (rated: number, likes: number, dislikes: number) =>
    `${rated} rated · 👍 ${likes} · 👎 ${dislikes}`,
  weeklyLikeRateTitle: "Like rate by week (8w)",
  hourlyLikeRateTitle: "Like rate by hour (KST)",
};

const ko: typeof en = {
  loginGoogle: "Google 로 로그인",
  pageTitle: "추천",
  pageIntro:
    "추천을 듣고 좋아요·별로를 선택. 좋아요한 곡은 라이브러리에, 별로한 아티스트는 다음 추천에서 빠집니다. 토너먼트로 비교하고 싶다면 → /worldcup",

  headerSong: "좋아하는 곡과 가까운 곡",
  headerGenre: "주요 장르 안에서",
  headerUnheard: "취향 밖 — 새 영역 도전",
  headerIndie: "덜 알려진 아티스트의 숨은 명곡",
  headerSeedPrefix: "기반:",

  emptyNoRecs: "평가할 추천 없음.",
  generating: "추천 만드는 중… (~10초)",
  generate: "추천 만들기",

  countsRated: "평가",

  swipeHint: "스와이프 / 화살표 · ← 별로 · → 좋아요 · ↑ 정말 좋아요 · Space 재생",
  ratingFailed: "평가가 저장되지 않았습니다 — 연결을 확인하고 다시 시도해 주세요.",
  undoFailed: "되돌리기를 서버에 반영하지 못했습니다 — 다시 시도해 주세요.",
  dismiss: "닫기",

  rateStrongDislike: "정말 별로",
  rateDislike: "별로",
  ratePass: "패스",
  rateLike: "좋아요",
  rateSuperlike: "정말 좋아요",

  known: "이미 아는 곡",
  undo: "↩ 되돌리기",

  commentPlaceholder: "메모 (선택) — 평가와 함께 저장됨",

  modePickerTitle: "추천 방식",
  modeMakingShort: "만드는 중… (~10초)",
  modeNoNew: "이 방식으로는 새 추천이 없습니다. 다른 방식을 시도해 보세요.",
  modePickerHint:
    "선택한 방식으로 새 추천을 만듭니다. 평가한 곡(좋아요·이미 아는 곡)은 라이브러리에 반영됩니다.",

  modeMixLabel: "믹스",
  modeMixHint: "여러 방식 혼합",
  modeSongLabel: "곡 기반",
  modeSongHint: "좋아한 곡과 비슷한 곡",
  modeGenreLabel: "장르 기반",
  modeGenreHint: "주요 장르의 명곡",
  modeUnheardLabel: "안 들어본 장르",
  modeUnheardHint: "취향 밖의 새 장르",
  modeIndieLabel: "숨은 명곡",
  modeIndieHint: "청취자가 적은, 덜 알려진 좋은 곡",

  layoutToggleSwipe: "스와이프",
  layoutToggleBracket: "이상형 월드컵",
  bracketHint: "두 곡 중 듣고 싶은 쪽을 고르세요. 이긴 곡은 다음 라운드로 진출하고, 마지막에 남은 우승곡은 정말 좋아요로 기록됩니다.",
  bracketSkipBoth: "둘 다 건너뛰기",
  bracketWatchYt: "YouTube 에서 보기 ↗",
  bracketEmpty: "토너먼트를 진행할 새 추천이 부족합니다. 새 배치를 받을까요?",
  bracketNeedMore: (have: number, need: number) =>
    `토너먼트는 ${need}곡 필요 — 현재 ${have}곡. 더 만들까요?`,
  bracketRound: (round: number, totalRounds: number): string => {
    const remaining = totalRounds - round;
    if (remaining <= 1) return "결승";
    if (remaining === 2) return "준결승";
    if (remaining === 3) return "8강";
    return `${2 ** remaining}강`;
  },
  bracketPairOf: (idx: number, of: number): string => `${idx} / ${of}`,
  bracketChampionTitle: "🏆 우승",
  bracketChampionSub: "정말 좋아요로 저장됨. 준우승자들은 좋아요, 1라운드 탈락자는 패스로 기록됩니다.",
  bracketRestart: "새 토너먼트",
  bracketPatternTitle: "매칭 방식",
  bracketKeyboardHint: "← 왼쪽 · → 오른쪽 · Space 재생",
  bracketFinalBanner: "🏆 결승 — 우승곡을 골라주세요",
  bracketPatternRandom: "🎲 무작위",
  bracketPatternFavorites: "❤️ 최애끼리",
  bracketPatternOpposites: "⚡ 정반대끼리",
  bracketPatternCross: "🔀 장르 교차",
  bracketPatternHint:
    "무작위는 그냥 섞고, 최애끼리는 점수 높은 곡들을 먼저 붙이고, 정반대끼리는 점수 차이 큰 곡들을 맞붙입니다. 장르 교차는 '비슷한 곡'과 '안 들어본 장르' 추천을 번갈아 배치.",

  autoPickUnlockHint: (totalRated: number, need: number) =>
    `한 모드에서 5개 이상 평가하면 "자동 추천"이 켜져요 (지금까지 ${totalRated}개). 같은 모드로 ${need}개 더 평가해 보세요.`,
  autoPickLabel: (mode: string, pct: number) => `자동 추천: ${mode} (좋아요 ${pct}%)`,
  autoPickBasis: (n: number) => `최근 ${n}건의 평가 데이터 기반`,
  autoPickUse: "이 모드로 추천",
  modeAccuracyTitle: "🎯 모드별 정확도",
  modeAccuracySummary: (rated: number, likes: number, dislikes: number) =>
    `평가 ${rated}건 · 👍 ${likes} · 👎 ${dislikes}`,
  weeklyLikeRateTitle: "주별 좋아요 비율 (8주)",
  hourlyLikeRateTitle: "시간대별 좋아요 비율 (KST)",
};

export function recommendDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
