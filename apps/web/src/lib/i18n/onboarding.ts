import type { Locale } from "../i18n";

const en = {
  pageTitle: "One last step",
  intro:
    "Before we light up your dashboard, we need three quick confirmations. These exist because Earprint handles your personal music data — and we'd rather you opt in clearly than discover obligations buried in a 30-page document.",

  age: {
    label: "I am at least 16 years old.",
    hint: "Required under GDPR Article 8 to use Earprint without parental consent.",
  },
  tos: {
    label: "I have read and accept the Terms of Service and Privacy Policy.",
    hintPrefix: "Reading:",
    terms: "Terms",
    privacy: "Privacy Policy",
    hintSuffix:
      "Both documents are short — version " + "{VERSION}" + ", last updated 2026-05-25.",
  },
  ai: {
    label: "I consent to AI-generated profiling of my music taste.",
    hint: "Optional. Powers the Music Zodiac and the AI music-psychology profile. You can revoke this any time from /account; the rest of the service keeps working.",
  },

  submit: "Continue to my dashboard →",
  submitting: "Saving…",

  required:
    "You need to confirm your age and accept the Terms + Privacy Policy to continue.",
  declineNote:
    "Don't want to consent? Sign out below and your account will be removed within 30 days of inactivity.",
  signOut: "Sign out instead",
};

const ko: typeof en = {
  pageTitle: "마지막 한 단계",
  intro:
    "대시보드를 열기 전에 짧은 확인 세 가지가 필요합니다. Earprint 는 개인 음악 데이터를 다루므로, 30페이지 약관에 묻혀있는 것보다 명시적으로 동의받는 게 맞다고 봅니다.",

  age: {
    label: "만 16세 이상입니다.",
    hint: "GDPR 제8조에 따라 부모 동의 없이 사용하려면 16세 이상이어야 합니다.",
  },
  tos: {
    label: "이용약관과 개인정보처리방침을 읽고 동의합니다.",
    hintPrefix: "확인:",
    terms: "이용약관",
    privacy: "개인정보처리방침",
    hintSuffix: "두 문서 모두 짧습니다 — 버전 " + "{VERSION}" + ", 최종 수정 2026-05-25.",
  },
  ai: {
    label: "내 음악 취향에 대한 AI 기반 프로파일링에 동의합니다.",
    hint: "선택. 음악 별자리와 AI 음악 심리분석에 사용됩니다. 언제든 /account 에서 해제할 수 있고, 나머지 서비스는 그대로 동작합니다.",
  },

  submit: "내 대시보드로 →",
  submitting: "저장 중…",

  required: "계속하려면 나이 확인과 이용약관·개인정보처리방침 동의가 필요합니다.",
  declineNote:
    "동의하지 않으시려면 아래에서 로그아웃하세요. 비활성 계정은 30일 후 자동 삭제됩니다.",
  signOut: "대신 로그아웃",
};

export function onboardingDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
