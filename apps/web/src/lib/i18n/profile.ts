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
  statsTitle: "The data behind the analysis",
  statsDesc: "The library figures the AI reads. Run more analysis to sharpen them.",
  statSongs: "Liked songs",
  statArtists: "Artists",
  statGenres: "Genres",
  statAnalyzed: "Analyzed",
  statTopGenre: "Top genre",
  statAlbumDepth: "Album depth",
  feelEnergy: "Energy",
  feelTempo: "Tempo",
  feelAcoustic: "Acoustic",
  localeMismatch:
    "This analysis was written in another language — regenerate it to read it in English.",
  capped:
    "🌙 Today's shared AI limit was reached — please try generating your analysis again tomorrow.",
  shareHeading: "Share your music persona",
  shareCopy: "Copy share link",
  shareCopied: "Link copied",
  shareOpen: "Open",
  shareImage: "Save image",
  topArtists: "Top artists",
  topPercent: (n: number) => `Top ${n}% digging`,
  shareCtaLine: "Made with Earprint — discover your own music taste.",
  shareCtaButton: "Analyze my taste →",
  shareNotFound: "This shared profile doesn't exist.",
};

const ko: typeof en = {
  signInWithGoogle: "Google 로 로그인",
  pageTitle: "AI 음악 심리분석",
  introText:
    "좋아요 라이브러리의 장르·무드·아티스트 분포를 Gemini 가 해석해서 취향과 성격을 프로파일링해요. 분석을 더 돌릴수록 정확해집니다.",
  generatedAt: "생성일:",
  constellationTitle: "취향 별자리",
  constellationDesc:
    "장르를 별로, 같은 곡에 함께 태그된 장르를 선으로 이어요. 자주 섞어 듣는 장르일수록 가까이 모입니다.",
  noProfile:
    "아직 AI 분석이 없어요. 위 버튼으로 만들어 보세요. (라이브러리 분석을 먼저 돌리면 장르·무드 데이터가 채워져 더 정확해집니다.)",
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
  generate: "AI 분석 만들기",
  errorPrefix: "오류:",
  errorStatus: "오류",
  constellationHint: "드래그·휠로 탐색 · 별을 눌러 함께 쓰는 장르 보기",
  statsTitle: "분석의 바탕이 된 데이터",
  statsDesc: "AI 가 읽은 라이브러리 수치예요. 분석을 더 돌릴수록 또렷해집니다.",
  statSongs: "좋아요 곡",
  statArtists: "아티스트",
  statGenres: "장르",
  statAnalyzed: "분석 완료",
  statTopGenre: "최다 장르",
  statAlbumDepth: "앨범 몰입도",
  feelEnergy: "에너지",
  feelTempo: "템포",
  feelAcoustic: "어쿠스틱",
  localeMismatch:
    "이 분석은 다른 언어로 작성됐어요 — 한국어로 보려면 다시 생성해 주세요.",
  capped:
    "🌙 오늘의 공용 AI 한도에 도달했어요 — 내일 다시 분석을 생성해 주세요.",
  shareHeading: "내 음악 페르소나 공유",
  shareCopy: "공유 링크 복사",
  shareCopied: "링크 복사됨",
  shareOpen: "열기",
  shareImage: "이미지 저장",
  topArtists: "최다 아티스트",
  topPercent: (n: number) => `디깅 상위 ${n}%`,
  shareCtaLine: "Earprint 로 만든 결과 — 내 음악 취향도 알아보세요.",
  shareCtaButton: "내 취향 분석하기 →",
  shareNotFound: "존재하지 않는 공유 프로필이에요.",
};

export function profileDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
