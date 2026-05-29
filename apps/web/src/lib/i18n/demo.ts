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

  // R38 demo worldcup widget
  wcTitle: "Try the worldcup (sample)",
  wcBody:
    "Run an 8-track bracket to crown your #1. ▶ 30s previews · no sign-in — the real app runs on YOUR library.",
  wcStart: "Start",
  wcOpenTitle: "🏆 Sample worldcup",
  wcClose: "Close",
  wcChampionLabel: "Sample champion",
  wcChampionBody:
    "Fun, right? The real thing runs on YOUR YouTube Music / Spotify library.",
  wcAgain: "Again",
  wcDoMine: "Do it with mine →",
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

  // R38 demo worldcup widget
  wcTitle: "월드컵 직접 해보기 (샘플)",
  wcBody:
    "8곡으로 토너먼트를 돌려 최애 1곡을 가려보세요. ▶ 30초 미리듣기 지원 · 로그인 불필요 — 실제 앱에선 내 라이브러리 곡으로 돌아갑니다.",
  wcStart: "시작",
  wcOpenTitle: "🏆 샘플 월드컵",
  wcClose: "닫기",
  wcChampionLabel: "샘플 우승",
  wcChampionBody:
    "재밌었죠? 실제 앱에선 내 YouTube Music / Spotify 라이브러리로 돌아갑니다.",
  wcAgain: "다시",
  wcDoMine: "내 걸로 시작 →",
};

export function demoDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
