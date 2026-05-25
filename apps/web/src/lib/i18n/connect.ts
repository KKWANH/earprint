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
  apiSyncNote:
    "On first use Google will ask you to grant Earprint read-only access to your YouTube account. Until Google verifies the app you'll see an \"unverified app\" warning — click Advanced → Continue to proceed.",
  apiSyncButton: "Sync from YouTube",
  apiSyncRunning: "Syncing…",
  apiSyncSuccess: (captured: number, expected: number) =>
    `✓ Synced ${captured.toLocaleString()} of ${expected.toLocaleString()} likes`,
  apiSyncEmpty:
    "Your YouTube Liked Videos playlist is empty. (YT Music likes that have no video equivalent won't appear here — use the extension on desktop for full coverage.)",
  apiSyncFailed: "Sync failed",
  apiYtConnected: "✓ YouTube connected. Press Sync from YouTube to run.",
  apiYtCancelled: "YouTube connection cancelled.",
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
  apiSyncNote:
    "처음 사용 시 Google 이 Earprint 의 YouTube 읽기 권한을 요청합니다. 앱 인증 전까지는 \"확인되지 않은 앱\" 경고가 뜹니다 — 고급 → 계속 진행을 누르세요.",
  apiSyncButton: "YouTube 에서 동기화",
  apiSyncRunning: "동기화 중…",
  apiSyncSuccess: (captured: number, expected: number) =>
    `✓ ${expected.toLocaleString()}곡 중 ${captured.toLocaleString()}곡 동기화 완료`,
  apiSyncEmpty:
    "YouTube 좋아요 영상이 없습니다. (영상이 없는 YT Music 좋아요는 여기 안 잡힙니다 — 데스크탑 확장이 완전 커버리지)",
  apiSyncFailed: "동기화 실패",
  apiYtConnected: "✓ YouTube 연결됨. 'YouTube 에서 동기화' 를 눌러 실행하세요.",
  apiYtCancelled: "YouTube 연결을 취소했습니다.",
};

export function connectDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
