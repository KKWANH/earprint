import type { Locale } from "../i18n";

const en = {
  // map/page.tsx
  loginGoogle: "Sign in with Google",
  pageTitle: "Taste artist map",
  likedArtists: (n: number) => `${n} liked artists`,
  ghostSuffix: (n: number) => ` · ${n} unheard recommendations`,
  subtitleTail: " · the more similar the genres, the closer they cluster",
  emptyState:
    "No synced songs yet. Sync your liked-songs list with the extension first.",

  // ArtistMap.tsx
  searchPlaceholder: "Search artists…",
  legendLine1: "Drag · scroll to explore · click a dot for details",
  legendEmptyCircle: "◯ empty circle",
  legendEmptyCircleRest: " = unheard recommendation — click to add",
  fewAnalyzedWarning:
    "Few songs analyzed, so clusters are blurry. They sharpen once song analysis finishes.",
  hideRecommendations: "🟢 Hide recommendations",
  showRecommendations: "◯ Show recommendations",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitView: "Fit to view",
  close: "Close",
  ghostSubtitle: "Unheard related artist",
  ghostCloseToPre: "Close to your taste in ",
  ghostCloseToPost: ".",
  addToLibraryPrompt: "Add to library — how much do you like them?",
  rateHeard: "Heard it",
  rateLike: "Love it",
  rateFavorite: "Absolute favorite",
  processing: "Processing…",
  ghostAddNote:
    "A signature track is added to your library and the map re-sorts.",
  dislikeButton: "🚫 Don't like — remove from recommendations",
  likedCount: (n: string) => `${n} liked songs`,
  noGenresYet: "Genres not analyzed yet",
  closeTasteArtists: "Artists close to your taste",
  affinityPrompt:
    "How much do you like them? — reflected in map size and recommendation weight",
  affinityNormal: "Okay",
  affinityLike: "Like",
  affinityFavorite: "Favorite",
  excludeBusy: "Processing…",
  excludeButton: "Exclude this artist from map & analysis (YouTubers, etc.)",
};

const ko: typeof en = {
  // map/page.tsx
  loginGoogle: "Google 로 로그인",
  pageTitle: "취향 아티스트 맵",
  likedArtists: (n: number) => `좋아요한 아티스트 ${n}명`,
  ghostSuffix: (n: number) => ` · 안 들어본 추천 ${n}명`,
  subtitleTail: " · 장르가 비슷할수록 가까이 모입니다",
  emptyState:
    "아직 동기화된 곡이 없습니다. 확장 프로그램으로 좋아요 목록을 먼저 동기화하세요.",

  // ArtistMap.tsx
  searchPlaceholder: "아티스트 검색…",
  legendLine1: "드래그·휠로 탐색 · 점을 눌러 상세",
  legendEmptyCircle: "◯ 빈 원",
  legendEmptyCircleRest: " = 안 들어본 추천 — 눌러서 추가",
  fewAnalyzedWarning:
    "분석된 곡이 적어 군집이 흐립니다. 곡 분석을 끝내면 또렷해집니다.",
  hideRecommendations: "🟢 추천 숨기기",
  showRecommendations: "◯ 추천 보기",
  zoomIn: "확대",
  zoomOut: "축소",
  fitView: "전체 보기",
  close: "닫기",
  ghostSubtitle: "안 들어본 연관 아티스트",
  ghostCloseToPre: "당신의 ",
  ghostCloseToPost: " 취향과 가깝습니다.",
  addToLibraryPrompt: "라이브러리에 추가 — 얼마나 좋아하세요?",
  rateHeard: "들어봤어요",
  rateLike: "좋아해요",
  rateFavorite: "최애예요",
  processing: "처리하는 중…",
  ghostAddNote: "대표곡이 라이브러리에 추가되고 맵이 다시 정렬됩니다.",
  dislikeButton: "🚫 싫어해요 — 추천에서 빼기",
  likedCount: (n: string) => `좋아요 ${n}곡`,
  noGenresYet: "아직 장르 분석 전",
  closeTasteArtists: "취향이 가까운 아티스트",
  affinityPrompt: "얼마나 좋아하세요? — 맵 크기와 추천 가중치에 반영됩니다",
  affinityNormal: "보통",
  affinityLike: "좋아함",
  affinityFavorite: "최애",
  excludeBusy: "처리 중…",
  excludeButton: "맵·분석에서 이 아티스트 제외 (유튜버 등)",
};

export function mapDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
