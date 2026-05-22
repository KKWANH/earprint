import type { Locale } from "../i18n";

const en = {
  loginGoogle: "Sign in with Google",
  pageTitle: "Recommendation World Cup",
  pageIntro:
    "Listen to recommendations and rate them like/pass. Likes and songs you already know are added to your library; artists you pass on are excluded from future recommendations.",

  // HEADER labels (why-recommended strip)
  headerSong: "Similar to songs you love",
  headerGenre: "Your core genres",
  headerUnheard: "Outside your taste",
  headerIndie: "Hidden indie gems",

  // empty state
  emptyNoRecs: "No recommendations to rate.",
  generating: "Generating… (~10s)",
  generate: "Generate recommendations",

  // counts
  countsRated: "Rated",

  // swipe hint
  swipeHint: "← Pass · → Like · ↑ Love it",

  // rate button titles
  rateStrongDislike: "Really bad",
  rateDislike: "Pass",
  ratePass: "Skip",
  rateLike: "Like",
  rateSuperlike: "Love it",

  // controls
  known: "Already know it",
  undo: "↩ Undo",

  // comment textarea
  commentPlaceholder: "A note about this song (optional) — saved with your rating",

  // ModePicker
  modePickerTitle: "Choose a recommendation style",
  modeMakingShort: "Generating… (~10s)",
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
  modeIndieLabel: "Hidden indie",
  modeIndieHint: "Lesser-known small artists",
};

const ko: typeof en = {
  loginGoogle: "Google 로 로그인",
  pageTitle: "추천 월드컵",
  pageIntro:
    "추천을 듣고 좋아요/별로로 평가하세요. 좋아요·이미 아는 곡은 라이브러리에 반영되고, 별로한 아티스트는 다음 추천에서 제외됩니다.",

  headerSong: "좋아한 곡과 비슷",
  headerGenre: "내 핵심 장르",
  headerUnheard: "취향 밖 탐험",
  headerIndie: "숨은 인디",

  emptyNoRecs: "평가할 추천이 없어요.",
  generating: "추천 만드는 중… (~10초)",
  generate: "추천 만들기",

  countsRated: "평가",

  swipeHint: "← 별로 · → 좋아요 · ↑ 정말 좋아요",

  rateStrongDislike: "정말 별로",
  rateDislike: "별로",
  ratePass: "패스",
  rateLike: "좋아요",
  rateSuperlike: "정말 좋아요",

  known: "이미 아는 곡",
  undo: "↩ 되돌리기",

  commentPlaceholder: "이 곡에 대한 메모 (선택) — 평가와 함께 저장됩니다",

  modePickerTitle: "추천 방식 고르기",
  modeMakingShort: "만드는 중… (~10초)",
  modePickerHint:
    "고른 방식으로 새 추천 묶음이 만들어집니다. 평가한 곡(좋아요·이미 앎)은 라이브러리에 반영됩니다.",

  modeMixLabel: "골고루",
  modeMixHint: "여러 방식을 섞어서",
  modeSongLabel: "곡 기반",
  modeSongHint: "좋아한 곡과 비슷한 곡",
  modeGenreLabel: "장르 기반",
  modeGenreHint: "내 핵심 장르의 명곡",
  modeUnheardLabel: "안 들어본 장르",
  modeUnheardHint: "취향 밖 새 장르",
  modeIndieLabel: "숨은 인디",
  modeIndieHint: "덜 알려진 영세 아티스트",
};

export function recommendDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
