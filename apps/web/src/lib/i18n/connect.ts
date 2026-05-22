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
};

export function connectDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
