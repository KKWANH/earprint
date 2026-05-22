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
    "라이브러리의 장르·무드·아티스트 분포를 Gemini 가 해석해 취향과 성격을 풀어냅니다. 분석을 더 돌릴수록 정확해집니다.",
  generatedAt: "생성일:",
  constellationTitle: "취향 별자리",
  constellationDesc:
    "장르가 별, 같은 곡에 같이 태그된 장르가 선으로 연결됩니다. 자주 섞어 듣는 장르일수록 가까이 모입니다.",
  noProfile:
    "분석이 없습니다. 위 버튼으로 만드세요. 라이브러리 분석을 먼저 돌리면 장르·무드 데이터가 채워져 더 정확합니다.",
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
  generate: "분석 만들기",
  errorPrefix: "오류:",
  errorStatus: "오류",
  constellationHint: "드래그·휠로 탐색 · 별을 눌러 함께 쓰는 장르 보기",
  statsTitle: "분석의 근거 데이터",
  statsDesc: "AI 가 분석에 사용한 라이브러리 수치. 더 돌릴수록 또렷해집니다.",
  statSongs: "좋아요 곡",
  statArtists: "아티스트",
  statGenres: "장르",
  statAnalyzed: "분석된 곡",
  statTopGenre: "최다 장르",
  statAlbumDepth: "앨범 몰입도",
  feelEnergy: "에너지",
  feelTempo: "템포",
  feelAcoustic: "어쿠스틱",
  localeMismatch:
    "이 분석은 다른 언어로 작성된 것입니다. 한국어로 보려면 다시 생성하세요.",
  capped:
    "🌙 오늘 공용 AI 한도 도달 — 내일 다시 시도하세요.",
  shareHeading: "페르소나 공유하기",
  shareCopy: "공유 링크 복사",
  shareCopied: "링크 복사됨",
  shareOpen: "열기",
  shareImage: "이미지 저장",
  topArtists: "주요 아티스트",
  topPercent: (n: number) => `디깅 상위 ${n}%`,
  shareCtaLine: "Earprint 가 분석한 결과. 내 음악 취향도 알아볼까요?",
  shareCtaButton: "내 취향 분석하기 →",
  shareNotFound: "존재하지 않는 공유 페이지.",
};

export function profileDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
