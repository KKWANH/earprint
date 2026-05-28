import type { Locale } from "../i18n";

const en = {
  loginGoogle: "Sign in with Google",
  back: "← Library",
  pageTitle: "All genres",
  subtitle: (n: number) => `${n} genres tagged across your library`,
  empty: "Run a library analysis to fill in genres.",
  // Genre-request form (R23d) — two branches: catalog gap vs missing
  // genres on the user's own tracks.
  requestTitle: "Don't see what you expected?",
  requestIntro: "Tell us which case applies — we'll take a look.",
  requestKindCatalog: "Add a new genre to the catalogue",
  requestKindCatalogHint:
    "e.g. \"vaporwave should be its own tag\" — the genre exists in real life but Earprint has no entries.",
  requestKindReanalysis: "My tracks are missing genres",
  requestKindReanalysisHint:
    "e.g. \"all my Mariya Takeuchi tracks have no genres tagged.\" We'll rerun the analysis for that artist.",
  requestSubjectCatalog: "Genre name",
  requestSubjectReanalysis: "Artist name",
  requestNote: "Note (optional)",
  requestSubmit: "Send",
  requestSent: "Thanks — we'll look at this.",
  requestRateLimited: "Daily limit reached. Try again tomorrow.",
};

const ko: typeof en = {
  loginGoogle: "Google 로 로그인",
  back: "← 라이브러리",
  pageTitle: "전체 장르",
  subtitle: (n: number) => `라이브러리에 태그된 ${n}개 장르`,
  empty: "라이브러리 분석을 돌리면 장르가 채워집니다.",
  requestTitle: "찾는 장르가 안 보이세요?",
  requestIntro: "어떤 경우인지 알려주세요 — 살펴볼게요.",
  requestKindCatalog: "카탈로그에 새 장르 추가 요청",
  requestKindCatalogHint:
    "예: \"vaporwave 가 따로 있어야 한다\" — 실제로 존재하는 장르인데 Earprint에 항목이 없을 때.",
  requestKindReanalysis: "내 곡들이 장르 없이 떠요",
  requestKindReanalysisHint:
    "예: \"내 마리야 타케우치 곡들에 장르가 안 잡혀있다.\" 그 아티스트 곡들 재분석을 돌릴게요.",
  requestSubjectCatalog: "장르명",
  requestSubjectReanalysis: "아티스트명",
  requestNote: "메모 (선택)",
  requestSubmit: "보내기",
  requestSent: "고마워요 — 확인해 볼게요.",
  requestRateLimited: "오늘 요청 한도에 도달했어요. 내일 다시 시도해 주세요.",
};

export function genresIndexDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
