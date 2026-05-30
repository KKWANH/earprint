import type { Locale } from "../i18n";

/**
 * /connect i18n — single-mode flow.
 *
 * The earlier "Fast Import (API)" mode was removed because the YouTube
 * Data API only exposes YouTube's "Liked Videos" playlist, not YT
 * Music's "Liked Music" — testers consistently got 20-30% of their
 * actual library and missed the rest. Chrome extension is now the
 * only import path. Most strings below are about installing /
 * authenticating that extension.
 */

const en = {
  // connect/page.tsx
  loginGoogle: "Sign in with Google",
  pageTitle: "Connect the extension",
  syncTokenTitle: "Sync token",
  syncTokenDesc:
    "After you click \"Connect from web\" inside the extension popup, the token below is captured automatically. (Copy it manually only if the auto-pairing didn't fire.)",
  libraryTitle: (n: number) => `Your library · ${n} tracks`,
  analysisDashboard: "Analysis dashboard →",
  noSyncedSongs: "No tracks synced yet. Run sync from the extension popup.",

  // TokenBox.tsx
  copy: "Copy",
  copied: "Copied",

  // Single-mode install + steps + privacy
  installTitle: "Earprint Chrome extension",
  installBody:
    "Earprint reads your YouTube Music Liked Music page directly inside your own logged-in tab. The Chrome extension is the only way that ships full coverage — the official YouTube Data API exposes only a subset of liked items (the YT-side \"Liked Videos\" list, not the Music-side \"Liked Music\" list), so users routinely lose 70%+ of their library through that path.",
  installCta: "Install from Chrome Web Store",
  installSteps: [
    "Install the extension from the Chrome Web Store button above.",
    "Pin the Earprint icon to your toolbar (optional but nicer).",
    "Open music.youtube.com and sign in to your own account.",
    "Navigate to \"Liked music\" (left sidebar → Library → Liked music).",
    "Click the Earprint icon and press \"Sync liked songs\". The extension scrolls the page for you and uploads each captured track in batches — a tab crash mid-scroll won't lose progress.",
  ],
  privacyNote:
    "The extension runs inside your tab as you. We never receive your YouTube session cookies, Authorization headers, or SAPISID hash. The only thing the server ever sees is the same per-song fields the UI already shows you: title, artist, album, videoId, like-position.",

  // LastSyncBadge / formatRelative
  lastSyncHeaderHint: (expected: string) =>
    ` · header showed ${expected} (re-sync to pick up the rest)`,
  lastSyncLine: (captured: string, headerHint: string, ago: string) =>
    `✓ Last sync — ${captured} songs sent${headerHint} · ${ago}`,
  relJustNow: "just now",
  relMinAgo: (n: number) => `${n} min ago`,
  relHrAgo: (n: number) => `${n}h ago`,
  relDayAgo: (n: number) => `${n}d ago`,
};

const ko: typeof en = {
  loginGoogle: "Google 로 로그인",
  pageTitle: "확장 연결",
  syncTokenTitle: "동기화 토큰",
  syncTokenDesc:
    "Chrome 확장 팝업에서 \"웹에서 연결\"을 누르면 아래 토큰이 자동으로 잡힙니다. (자동 페어링이 안 됐을 때만 수동 복사하세요.)",
  libraryTitle: (n: number) => `내 라이브러리 · ${n}곡`,
  analysisDashboard: "분석 대시보드 →",
  noSyncedSongs: "동기화된 곡 없음. 확장 팝업에서 동기화를 실행하세요.",

  copy: "복사",
  copied: "복사됨",

  installTitle: "Earprint Chrome 확장",
  installBody:
    "Earprint 는 이용자가 로그인된 탭에서 YouTube Music 좋아요 한 음악 페이지를 직접 읽습니다. 완전한 라이브러리 동기화는 Chrome 확장 경로만 가능합니다 — 공식 YouTube Data API 는 \"좋아요 한 영상\" 목록만 노출하고 YT Music \"좋아요 한 음악\" 목록은 노출하지 않기 때문에, 그 경로로는 통상 70% 이상의 곡이 누락됩니다.",
  installCta: "Chrome Web Store 에서 설치",
  installSteps: [
    "위 버튼으로 Chrome Web Store 에서 확장을 설치합니다.",
    "도구모음에 Earprint 아이콘 고정 (선택, 더 편함).",
    "music.youtube.com 접속 후 본인 계정으로 로그인.",
    "\"좋아요 한 음악\" 진입 (좌측 사이드바 → 라이브러리 → 좋아요 한 음악).",
    "Earprint 아이콘 클릭 → \"Sync liked songs\". 확장이 자동으로 페이지를 스크롤하면서 곡 단위로 배치 업로드합니다 — 도중 탭이 죽어도 모은 만큼은 서버에 남습니다.",
  ],
  privacyNote:
    "확장은 본인 탭에서 본인 자격으로 실행됩니다. 서버는 YouTube 세션 쿠키 · Authorization 헤더 · SAPISID 해시를 받지 않습니다. 서버가 보는 것은 화면에 이미 표시되는 곡당 정보 — title · artist · album · videoId · 좋아요-위치 뿐입니다.",

  lastSyncHeaderHint: (expected: string) =>
    ` · 페이지 헤더는 ${expected}곡 표시 (다시 동기화하면 누락분 추가)`,
  lastSyncLine: (captured: string, headerHint: string, ago: string) =>
    `✓ 마지막 동기화 — ${captured}곡 전송됨${headerHint} · ${ago}`,
  relJustNow: "방금",
  relMinAgo: (n: number) => `${n}분 전`,
  relHrAgo: (n: number) => `${n}시간 전`,
  relDayAgo: (n: number) => `${n}일 전`,
};

export function connectDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
