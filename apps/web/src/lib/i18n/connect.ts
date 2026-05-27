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
  apiSyncSuccessFiltered: (captured: number, raw: number, skipped: number) =>
    `✓ ${captured.toLocaleString()} music tracks · ${skipped.toLocaleString()} non-music skipped (out of ${raw.toLocaleString()} liked videos scanned)`,
  apiSyncSkippedTitle: "Examples we skipped",
  apiSyncSkippedReason: {
    short: "looks like a Short",
    long: "too long — likely a livestream / podcast",
    "non-music": "title looks like an interview / vlog / reaction",
    "low-score": "didn't look enough like music",
  } as Record<string, string>,
  apiSyncEmpty:
    "Your YouTube Liked Videos playlist is empty. (YT Music likes that have no video equivalent won't appear here — use the extension on desktop for full coverage.)",
  apiSyncFailed: "Sync failed",
  apiYtConnected: "✓ YouTube connected. Press Sync from YouTube to run.",
  apiYtCancelled: "YouTube connection cancelled.",

  // Two-mode picker copy (Fast vs Exact)
  modesHeader: "Pick your sync mode",
  modesSubhead:
    "Two ways to bring your YouTube Music likes into Earprint. They're not mutually exclusive — start with one, switch later if you want.",

  fastModeBadge: "Fast",
  fastModeTitle: "Quick import (API, mobile-friendly)",
  fastModeProTitle: "Best for",
  fastModePros: [
    "Works on phone / tablet / any browser — no install",
    "Single click after one-time Google permission",
    "Smart music filter weeds out vlogs / podcasts / Shorts before they reach your library",
    "Lower policy risk — uses Google's official API, your OAuth scope",
  ],
  fastModeConTitle: "Trade-offs",
  fastModeCons: [
    "Reads your YouTube \"Liked Videos\" — not the YT Music-only Liked Music playlist",
    "Pure-audio YT Music likes without a regular YouTube video equivalent may be missing",
    "Some non-music likes (rare music interviews, classical lectures) get filtered out",
  ],

  exactModeBadge: "Exact",
  exactModeTitle: "Exact import (Chrome extension, desktop)",
  exactModeProTitle: "Best for",
  exactModePros: [
    "Reads YouTube Music's \"Liked Music\" page directly — exact same list you see",
    "Includes Music-only releases that the Data API can't reach",
    "No filtering necessary — everything on that page is already a song",
    "Order matches your YT Music likes (newest-first)",
  ],
  exactModeConTitle: "Trade-offs",
  exactModeCons: [
    "Requires desktop Chrome + one-time extension install",
    "Higher policy sensitivity than the official API (we never send your YouTube cookies / auth / SAPISID to our server — only normalised track metadata)",
    "Sync needs the music.youtube.com tab open in front",
  ],
  exactModePrivacyNote:
    "The extension runs in your tab as you. We never receive your YouTube session cookies, Authorization headers, or SAPISID hash. The server only sees the same per-song fields any sync surfaces: title, artist, album, videoId, like-position.",};

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
  apiSyncSuccessFiltered: (captured: number, raw: number, skipped: number) =>
    `✓ 음악 ${captured.toLocaleString()}곡 인식 · 비음악 ${skipped.toLocaleString()}개 제외 (스캔된 좋아요 영상 ${raw.toLocaleString()}개 중)`,
  apiSyncSkippedTitle: "제외된 예시",
  apiSyncSkippedReason: {
    short: "Shorts 영상으로 보입니다",
    long: "재생 시간이 너무 김 — 라이브 / 팟캐스트로 추정",
    "non-music": "제목이 인터뷰 / 브이로그 / 리액션 같음",
    "low-score": "음악으로 보이는 신호가 약함",
  } as Record<string, string>,
  apiSyncEmpty:
    "YouTube 좋아요 영상이 없습니다. (영상이 없는 YT Music 좋아요는 여기 안 잡힙니다 — 데스크탑 확장이 완전 커버리지)",
  apiSyncFailed: "동기화 실패",
  apiYtConnected: "✓ YouTube 연결됨. 'YouTube 에서 동기화' 를 눌러 실행하세요.",
  apiYtCancelled: "YouTube 연결을 취소했습니다.",

  modesHeader: "동기화 방식 선택",
  modesSubhead:
    "YouTube Music 좋아요를 Earprint 에 가져오는 두 가지 방법. 상호 배타적이지 않습니다 — 하나로 시작하고 나중에 바꿔도 됩니다.",

  fastModeBadge: "Fast",
  fastModeTitle: "빠른 가져오기 (API, 모바일 가능)",
  fastModeProTitle: "장점",
  fastModePros: [
    "휴대폰 / 태블릿 / 어떤 브라우저에서도 동작 — 설치 불필요",
    "1회 Google 권한 부여 후 클릭 한 번",
    "스마트 음악 필터가 브이로그 · 팟캐스트 · Shorts 를 라이브러리 전에 걸러냄",
    "정책 리스크 낮음 — Google 공식 API + 본인의 OAuth scope",
  ],
  fastModeConTitle: "단점",
  fastModeCons: [
    "YouTube 의 \"좋아요한 영상\" 을 읽음 — YT Music 전용 좋아요 한 음악 플레이리스트가 아님",
    "일반 YouTube 영상이 없는 순수 음원 형태의 YT Music 좋아요는 빠질 수 있음",
    "일부 비음악 좋아요 (드물게 음악 인터뷰, 클래식 강의 등) 가 필터링됨",
  ],

  exactModeBadge: "Exact",
  exactModeTitle: "정확한 가져오기 (Chrome 확장, 데스크탑)",
  exactModeProTitle: "장점",
  exactModePros: [
    "YouTube Music 의 \"좋아요 한 음악\" 페이지를 직접 읽음 — 본인이 보는 그 목록과 동일",
    "Data API 로 접근 불가한 Music 전용 발매작 포함",
    "필터링 불필요 — 그 페이지에 있는 모든 게 이미 곡",
    "순서가 YT Music 좋아요 순서 (최신순) 와 동일",
  ],
  exactModeConTitle: "단점",
  exactModeCons: [
    "데스크탑 Chrome + 1회 확장 설치 필요",
    "공식 API 보다 정책 민감도 높음 (단, 본인의 YouTube 쿠키 / Authorization / SAPISID 는 서버로 절대 전송되지 않음 — 정규화된 곡 메타데이터만 전송)",
    "동기화 시 music.youtube.com 탭이 활성화돼 있어야 함",
  ],
  exactModePrivacyNote:
    "확장은 본인 탭에서 본인 자격으로 실행됩니다. 서버는 YouTube 세션 쿠키 · Authorization 헤더 · SAPISID 해시를 받지 않습니다. 다른 동기화 경로와 마찬가지로, 곡당 title · artist · album · videoId · 좋아요-위치 만 전송됩니다.",};

export function connectDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
