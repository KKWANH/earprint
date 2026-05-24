import type { Locale } from "../i18n";

const en = {
  // connect/page.tsx
  loginGoogle: "Sign in with Google to get started",
  pageTitle: "Connect extension",
  syncTokenTitle: "Sync token",
  syncTokenDesc:
    "When you click “Connect from web” in the Chrome extension, this token connects automatically. (Only copy the value below if you need to connect manually.)",
  libraryTitle: (n: number) => `My library — ${n} songs`,
  analysisDashboard: "Analysis dashboard →",
  noSyncedSongs:
    "No synced songs yet. Run a sync from the extension.",

  // TokenBox.tsx
  copy: "Copy",
  copied: "Copied",

  // API sync card (sub-method, mobile-friendly)
  apiSyncTitle: "Sync via API (mobile-friendly)",
  apiSyncDesc:
    "Pulls your YouTube Liked Videos via the official Data API. No extension needed — works on any device. Coverage is partial: pure-audio YT Music likes without a video may be missing. Use the extension on desktop for full coverage.",
  apiSyncButton: "Sync from YouTube",
  apiSyncRunning: "Syncing…",
  apiSyncSuccess: (captured: number, expected: number) =>
    `✓ Synced ${captured.toLocaleString()} of ${expected.toLocaleString()} likes`,
  apiSyncFailed: "Sync failed",
  apiSyncNeedScope:
    "Your session is missing the YouTube scope — sign out and sign in again to grant access.",
};

const ko: typeof en = {
  // connect/page.tsx
  loginGoogle: "Google 로 로그인",
  pageTitle: "확장 연결",
  syncTokenTitle: "동기화 토큰",
  syncTokenDesc:
    "크롬 확장에서 “웹에서 연결”을 누르면 자동으로 연결됩니다. (수동 연결 시에만 아래 값을 복사하세요.)",
  libraryTitle: (n: number) => `내 라이브러리 · ${n}곡`,
  analysisDashboard: "분석 대시보드 →",
  noSyncedSongs: "동기화된 곡 없음. 확장에서 동기화를 실행하세요.",

  // TokenBox.tsx
  copy: "복사",
  copied: "복사됨",

  // API sync card (sub-method, mobile-friendly)
  apiSyncTitle: "API 동기화 (모바일 가능)",
  apiSyncDesc:
    "공식 Data API 로 유튜브 좋아요 영상을 가져옵니다. 확장 없이도, 어디서나 동작합니다. 영상이 없는 순수 음원 형태의 YT Music 좋아요는 빠질 수 있습니다 — 완전한 동기화는 데스크탑 확장을 사용하세요.",
  apiSyncButton: "YouTube 에서 동기화",
  apiSyncRunning: "동기화 중…",
  apiSyncSuccess: (captured: number, expected: number) =>
    `✓ ${expected.toLocaleString()}곡 중 ${captured.toLocaleString()}곡 동기화 완료`,
  apiSyncFailed: "동기화 실패",
  apiSyncNeedScope:
    "이 세션에 YouTube 권한이 없습니다. 로그아웃 후 다시 로그인하여 권한을 부여하세요.",
};

export function connectDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
