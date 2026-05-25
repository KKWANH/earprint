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

  // Plan / billing section
  planTitle: "Plan",
  planFree: "Free",
  planPro: "Pro",
  planLifetime: "Pro — Lifetime",
  planFreeDesc: "Core analysis with daily caps on the heavier features.",
  planProDesc: "Daily caps removed; all features unlocked.",
  planUntil: (date: string) => `Renews ${date}`,
  planExpires: (date: string) => `Active until ${date}`,
  planLifetimeDesc: "One-shot purchase. No renewal — Pro forever.",
  upgradeButton: "See plans →",
  managePlanButton: "Manage subscription",
  upgradeSuccess: "✓ Welcome to Pro! Enjoy the perks.",

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

  planTitle: "플랜",
  planFree: "Free",
  planPro: "Pro",
  planLifetime: "Pro — 평생",
  planFreeDesc: "핵심 분석은 무료. 무거운 기능은 일일 한도가 적용됩니다.",
  planProDesc: "일일 한도 제거. 모든 기능 활성화.",
  planUntil: (date: string) => `${date} 갱신`,
  planExpires: (date: string) => `${date} 까지 이용`,
  planLifetimeDesc: "일회성 구매. 갱신 없음 — 영구 Pro.",
  upgradeButton: "요금제 보기 →",
  managePlanButton: "구독 관리",
  upgradeSuccess: "✓ Pro 가입 완료! 즐겨주세요.",

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
