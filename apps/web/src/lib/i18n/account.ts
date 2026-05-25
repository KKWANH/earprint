import type { Locale } from "../i18n";

const en = {
  pageTitle: "Account",
  loginGoogle: "Sign in with Google",

  // Profile section
  profileTitle: "Profile",
  email: "Email",
  displayName: "Display name",
  memberSince: "Member since",
  unknown: "—",

  // Library section
  librarySummaryTitle: "Library summary",
  syncedTracks: (n: number) => `${n.toLocaleString()} synced tracks`,
  lastSyncedAt: "Last synced",
  neverSynced: "No tracks synced yet",
  openLibrary: "Open library →",

  // Connections section
  connectionsTitle: "Connections",
  connectionGoogle: "Google account",
  connectionGoogleDesc: "Used to sign you in to Earprint.",
  connectionYt: "YouTube Data API",
  connectionYtConnected: "Connected — used for API-mode sync on mobile.",
  connectionYtNotConnected:
    "Not connected. Connect to use the mobile-friendly API sync. The Chrome extension does not require this.",
  connectYtButton: "Connect YouTube",
  disconnectYtButton: "Disconnect YouTube",
  disconnecting: "Disconnecting…",
  disconnectFailed: "Disconnect failed",
  disconnectSuccess: "YouTube disconnected.",
  revokeNote:
    "You can also revoke access directly at",
  revokeUrl: "https://myaccount.google.com/permissions",

  // Sign out section
  signOutTitle: "Session",
  signOutDesc: "Sign out of Earprint on this device. You can sign back in any time.",
  signOut: "Sign out",

  // Delete section
  dangerTitle: "Delete account",
  dangerDesc:
    "Permanently delete your account and all associated data — liked tracks, analyses, recommendations, AI profile, share links, everything. This cannot be undone.",
  deleteAccount: "Delete my account & data",
  deleteConfirmWarn: "This is permanent and cannot be undone. Are you sure?",
  deleteConfirmYes: "Yes, delete everything",
  deleteCancel: "Cancel",

  // Footer links
  privacy: "Privacy policy",
  terms: "Terms",
};

const ko: typeof en = {
  pageTitle: "계정 관리",
  loginGoogle: "Google 로 로그인",

  profileTitle: "프로필",
  email: "이메일",
  displayName: "표시 이름",
  memberSince: "가입일",
  unknown: "—",

  librarySummaryTitle: "라이브러리 요약",
  syncedTracks: (n: number) => `동기화된 곡 ${n.toLocaleString()}곡`,
  lastSyncedAt: "마지막 동기화",
  neverSynced: "동기화된 곡 없음",
  openLibrary: "라이브러리 열기 →",

  connectionsTitle: "연결된 서비스",
  connectionGoogle: "Google 계정",
  connectionGoogleDesc: "Earprint 로그인에 사용됩니다.",
  connectionYt: "YouTube Data API",
  connectionYtConnected: "연결됨 — 모바일 API 동기화에 사용됩니다.",
  connectionYtNotConnected:
    "미연결. 모바일용 API 동기화를 사용하려면 연결하세요. Chrome 확장 사용 시엔 불필요합니다.",
  connectYtButton: "YouTube 연결",
  disconnectYtButton: "YouTube 연결 해제",
  disconnecting: "해제 중…",
  disconnectFailed: "연결 해제 실패",
  disconnectSuccess: "YouTube 연결을 해제했습니다.",
  revokeNote: "직접 권한을 취소하려면",
  revokeUrl: "https://myaccount.google.com/permissions",

  signOutTitle: "세션",
  signOutDesc: "이 기기에서 Earprint 에서 로그아웃합니다. 언제든 다시 로그인 가능.",
  signOut: "로그아웃",

  dangerTitle: "계정 삭제",
  dangerDesc:
    "계정과 모든 데이터(좋아요 곡·분석·추천·AI 프로필·공유 링크)를 영구 삭제합니다. 되돌릴 수 없습니다.",
  deleteAccount: "내 계정·데이터 삭제",
  deleteConfirmWarn: "영구 삭제되며 되돌릴 수 없습니다. 정말 삭제할까요?",
  deleteConfirmYes: "네, 전부 삭제",
  deleteCancel: "취소",

  privacy: "개인정보처리방침",
  terms: "이용약관",
};

export function accountDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
