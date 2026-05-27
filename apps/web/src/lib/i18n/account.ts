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

  // Connections section. Google sign-in is the only third-party
  // permission Earprint requests — the YouTube Data API path was
  // removed (it only covers ~25% of a typical YT Music library), so
  // there's no "Connect YouTube" / "Disconnect YouTube" flow any
  // more. The revoke link still helps users who granted youtube.
  // readonly during the deprecated flow and want to clean it up.
  connectionsTitle: "Connections",
  connectionGoogle: "Google account",
  connectionGoogleDesc:
    "Used to sign you in to Earprint. The only Google scopes we request are openid / email / profile — nothing else.",
  revokeNote:
    "You can revoke Earprint's access (and clean up the deprecated youtube.readonly scope if you granted it during the old API-sync flow) at",
  revokeUrl: "https://myaccount.google.com/permissions",

  // Plan / billing section
  planTitle: "Plan",
  planFree: "Free",
  planPro: "Pro",
  planFreeDesc:
    "Pay per analysis ($2 each) or go Pro for unlimited. The first analysis is on us.",
  planProDesc: "Unlimited analyses, all features unlocked.",
  planUntil: (date: string) => `Renews ${date}`,
  planExpires: (date: string) => `Active until ${date}`,
  creditsRemaining: (n: number) =>
    n === 1 ? `${n} analysis credit remaining` : `${n} analysis credits remaining`,
  upgradeButton: "See plans →",
  managePlanButton: "Manage subscription",
  upgradeSuccess: "✓ Welcome to Pro! Enjoy the perks.",

  // Sync token rotation
  syncTokenTitle: "Extension sync token",
  syncTokenDesc:
    "The token your Chrome extension uses to upload likes to your account. Rotate it if your extension install lives on a shared or lost machine — the next /connect visit re-pairs the extension automatically.",
  syncTokenRotateButton: "Rotate sync token",
  syncTokenRotateWarn:
    "This will immediately invalidate the current token. Your existing extension will need to re-pair via /connect.",
  syncTokenRotateConfirm: "Yes, rotate now",
  syncTokenRotating: "Rotating…",
  syncTokenRotated: "✓ Token rotated. Re-open /connect to re-pair the extension.",

  // AI consent
  aiConsentTitle: "AI profiling consent",
  aiConsentLabel: "Allow AI to profile my music taste",
  aiConsentDesc:
    "Powers the Music Zodiac and the AI music-psychology profile. Turning this off immediately stops new AI generations; the rest of Earprint keeps working. Existing AI profile and zodiac stay until you delete your account.",
  aiConsentOn: "On",
  aiConsentOff: "Off",
  aiConsentRevoked: "AI profiling is off.",
  aiConsentSinceLabel: "Granted on",

  // DSAR export
  exportTitle: "Download my data",
  exportDesc:
    "One-click JSON export of every row Earprint stores tied to your account. Satisfies GDPR Articles 15 (access) + 20 (portability). Contents: account fields (email, display name, plan, consent timestamps), every synced track (title / artist / album / videoId / liked position), AI analysis results, ratings + comments, recommendation history, Music Zodiac match, and Taste DNA inputs. Excludes anonymous infra telemetry (request logs, usage counters). For large libraries the file may be a few MB; the browser may take a moment to assemble it.",
  exportButton: "Download (JSON)",
  exportPreparing: "Preparing…",

  // Sign out section
  signOutTitle: "Session",
  signOutDesc: "Sign out of Earprint on this device. You can sign back in any time.",
  signOut: "Sign out",

  // Delete section
  dangerTitle: "Delete account",
  dangerDesc:
    "Permanently delete your account and all associated data — liked tracks, analyses, recommendations, AI profile, share links, everything. This cannot be undone.",
  deleteAccount: "Delete my account & data",
  deleteConfirmWarn:
    "This is permanent. Every row tied to your account — synced tracks, AI analyses, ratings, recommendations, profile, share links, payment state — is removed in the same transaction. There is no undo, and we cannot restore deleted accounts from backups. We recommend downloading your data first.",
  deleteTypeToConfirm: "Type DELETE to confirm",
  deleteTypePlaceholder: "DELETE",
  deleteConfirmYes: "Delete everything",
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
  connectionGoogleDesc:
    "Earprint 로그인에만 사용됩니다. Google scope 는 openid / email / profile 뿐, 그 외 없음.",
  revokeNote:
    "Earprint 의 접근 권한을 직접 회수하거나 (구버전 API 동기화 시 부여했던 youtube.readonly scope 가 남아 있다면 정리 포함) 하려면",
  revokeUrl: "https://myaccount.google.com/permissions",

  planTitle: "플랜",
  planFree: "Free",
  planPro: "Pro",
  planFreeDesc:
    "분석마다 $2 결제 또는 Pro 로 무제한. 첫 분석은 무료 크레딧 1회.",
  planProDesc: "분석 무제한, 모든 기능 활성화.",
  planUntil: (date: string) => `${date} 갱신`,
  planExpires: (date: string) => `${date} 까지 이용`,
  creditsRemaining: (n: number) => `남은 분석 크레딧 ${n}개`,
  upgradeButton: "요금제 보기 →",
  managePlanButton: "구독 관리",
  upgradeSuccess: "✓ Pro 가입 완료! 즐겨주세요.",

  syncTokenTitle: "확장 동기화 토큰",
  syncTokenDesc:
    "크롬 확장이 좋아요 곡을 본인 계정으로 업로드할 때 쓰는 토큰. 공유·분실 기기에 확장이 설치돼있다면 회전시키세요. 다음 /connect 방문 시 확장이 자동 재페어링됩니다.",
  syncTokenRotateButton: "토큰 회전",
  syncTokenRotateWarn:
    "기존 토큰이 즉시 무효화됩니다. 현재 확장은 /connect 에서 다시 페어링해야 합니다.",
  syncTokenRotateConfirm: "네, 회전",
  syncTokenRotating: "회전 중…",
  syncTokenRotated: "✓ 토큰 회전 완료. /connect 를 다시 열어 확장을 재페어링하세요.",

  aiConsentTitle: "AI 프로파일링 동의",
  aiConsentLabel: "내 음악 취향에 대한 AI 프로파일링을 허용",
  aiConsentDesc:
    "음악 별자리와 AI 음악 심리분석에 사용됩니다. 끄면 즉시 새 AI 생성이 중단되고, 나머지 서비스는 그대로 동작합니다. 이미 만들어진 AI 프로필·별자리는 계정 삭제 시까지 유지됩니다.",
  aiConsentOn: "켜짐",
  aiConsentOff: "꺼짐",
  aiConsentRevoked: "AI 프로파일링이 꺼져있습니다.",
  aiConsentSinceLabel: "동의 시각",

  exportTitle: "내 데이터 다운로드",
  exportDesc:
    "Earprint 가 이용자 계정에 묶여 저장하는 모든 행을 JSON 한 번에 내려받습니다. GDPR 제15조(열람) + 제20조(이동성) 충족. 포함: 계정 필드(이메일·표시 이름·플랜·동의 시각), 동기화된 모든 곡(곡명·아티스트·앨범·videoId·좋아요 위치), AI 분석 결과, 평가·코멘트, 추천 기록, Music Zodiac 매칭 결과, Taste DNA 입력값. 제외: 익명 인프라 텔레메트리(요청 로그·사용량 카운터). 라이브러리가 크면 파일이 수 MB 가 될 수 있고 브라우저가 잠시 모으는 시간이 필요합니다.",
  exportButton: "다운로드 (JSON)",
  exportPreparing: "준비 중…",

  signOutTitle: "세션",
  signOutDesc: "이 기기에서 Earprint 에서 로그아웃합니다. 언제든 다시 로그인 가능.",
  signOut: "로그아웃",

  dangerTitle: "계정 삭제",
  dangerDesc:
    "계정과 모든 데이터(좋아요 곡·분석·추천·AI 프로필·공유 링크)를 영구 삭제합니다. 되돌릴 수 없습니다.",
  deleteAccount: "내 계정·데이터 삭제",
  deleteConfirmWarn:
    "영구 삭제입니다. 동기화된 곡·AI 분석·평가·추천·프로필·공유 링크·결제 상태 모두 동일 트랜잭션에서 함께 삭제됩니다. 되돌릴 수 없으며 백업에서도 복원할 수 없습니다. 먼저 데이터를 내려받기를 권장합니다.",
  deleteTypeToConfirm: "확인을 위해 DELETE 를 입력하세요",
  deleteTypePlaceholder: "DELETE",
  deleteConfirmYes: "전부 삭제",
  deleteCancel: "취소",

  privacy: "개인정보처리방침",
  terms: "이용약관",
};

export function accountDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
