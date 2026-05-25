import type { Locale } from "../i18n";

const en = {
  pageTitle: "Sample analysis",
  bannerLabel: "Sample data",
  bannerBody:
    "This is what an Earprint analysis looks like — based on a fictional listener. Sign in to run yours on your real YouTube Music likes.",
  ctaPrimary: "Run mine — Sign in with Google",
  ctaSecondary: "Setup guide →",

  statsTitle: "Library at a glance",
  statSongs: "Liked songs",
  statArtists: "Artists",
  statGenres: "Top genre",
  statAlbumDepth: "Album depth",

  topArtistsTitle: "Most-liked artists",
  genresTitle: "Top genres",
  moodsTitle: "Top moods",
  audioTitle: "Audio feel",
  feelEnergy: "Energy",
  feelTempo: "Tempo",
  feelAcoustic: "Acoustic",

  profileTitle: "AI music-psychology profile",
  diggingScore: "Digging score",

  bottomCtaTitle: "Want yours?",
  bottomCtaBody:
    "Sign in, install the Chrome extension (or use API sync on mobile), and a fuller version of this page is yours in about 10 minutes.",
};

const ko: typeof en = {
  pageTitle: "분석 미리보기",
  bannerLabel: "샘플 데이터",
  bannerBody:
    "Earprint 분석이 어떻게 보이는지 — 가상의 청취자 데이터로 보여드립니다. 본인 YouTube Music 좋아요로 직접 돌리려면 로그인하세요.",
  ctaPrimary: "내 분석 돌리기 — Google 로 로그인",
  ctaSecondary: "설치 가이드 →",

  statsTitle: "라이브러리 한눈에",
  statSongs: "좋아요 곡",
  statArtists: "아티스트",
  statGenres: "최다 장르",
  statAlbumDepth: "앨범 몰입도",

  topArtistsTitle: "주요 아티스트",
  genresTitle: "주요 장르",
  moodsTitle: "주요 무드",
  audioTitle: "오디오 특성",
  feelEnergy: "에너지",
  feelTempo: "템포",
  feelAcoustic: "어쿠스틱",

  profileTitle: "AI 음악 심리분석",
  diggingScore: "디깅 점수",

  bottomCtaTitle: "내 분석 받으려면",
  bottomCtaBody:
    "로그인 → Chrome 확장 설치 (모바일이면 API 동기화) → 10분 정도면 이 페이지의 본인 버전이 완성됩니다.",
};

export function demoDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
