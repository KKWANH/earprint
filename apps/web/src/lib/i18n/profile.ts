import type { Locale } from "../i18n";

const en = {
  signInWithGoogle: "Sign in with Google",
  pageTitle: "AI Music Psychology",
  introText:
    "Gemini interprets the genre, mood and artist distribution of your liked-songs library to profile your taste and personality. The more analysis you run, the more accurate it gets.",
  generatedAt: "Generated:",
  constellationTitle: "Taste Constellation",
  constellationDesc:
    "Genres are stars; genres tagged together on the same track are linked by lines. The more often you mix two genres, the closer they cluster.",
  noProfile:
    "No AI analysis yet. Use the button above to generate one. (Run a library analysis first so genre and mood data is filled in for better accuracy.)",
  diggingScore: "Digging score",
  favoriteGenres: "Favorite genres",
  avoidedGenres: "Avoided genres",
  unexploredGenres: "Unexplored genres",
  moodProfile: "Mood Profile",
  improvementGuide: "Taste-Boosting Guide",
  personaScore: "Digging",
  emptyChip: "—",
  generating: "Analyzing with Gemini… (~10s)",
  reanalyze: "Analyze again",
  generate: "Generate AI analysis",
  errorPrefix: "Error:",
  errorStatus: "Error",
  constellationHint: "Drag / wheel to explore · tap a star to see the genres it blends with",
};

const ko: typeof en = {
  signInWithGoogle: "Google 로 로그인",
  pageTitle: "AI 음악 심리분석",
  introText:
    "좋아요 라이브러리의 장르·무드·아티스트 분포를 Gemini 가 해석해 취향·성격을 프로파일링합니다. 분석을 더 돌릴수록 정확해집니다.",
  generatedAt: "생성:",
  constellationTitle: "취향 별자리",
  constellationDesc:
    "장르를 별로, 같은 곡에 함께 태그된 장르를 선으로 잇습니다. 자주 섞어 듣는 장르일수록 가까이 모입니다.",
  noProfile:
    "아직 AI 분석이 없습니다. 위 버튼으로 생성하세요. (라이브러리 분석을 먼저 돌리면 장르·무드 데이터가 채워져 더 정확합니다.)",
  diggingScore: "디깅 점수",
  favoriteGenres: "좋아하는 장르",
  avoidedGenres: "피하는 장르",
  unexploredGenres: "안 들어본 장르",
  moodProfile: "무드 프로파일",
  improvementGuide: "취향 보강 가이드",
  personaScore: "디깅",
  emptyChip: "—",
  generating: "Gemini 분석 중… (~10초)",
  reanalyze: "다시 분석하기",
  generate: "AI 분석 생성",
  errorPrefix: "오류:",
  errorStatus: "오류",
  constellationHint: "드래그·휠로 탐색 · 별을 눌러 함께 쓰는 장르 보기",
};

export function profileDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
