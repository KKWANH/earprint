import type { Locale } from "../i18n";

export type ReportCategory =
  | "security"
  | "billing"
  | "account"
  | "bug"
  | "general";

const en = {
  pageTitle: "Contact & report",
  intro:
    "Refunds, account issues, bug reports, security disclosures, or just feedback — they all land in the same maintainer inbox. Pick a category so we can route the reply faster.",

  reportTitle: "Send a message",
  reportDesc:
    "Your message goes directly to the maintainer's inbox. No personal email addresses are exposed publicly.",

  fieldCategory: "Category",
  categories: {
    security: "Security vulnerability",
    billing: "Billing or refund",
    account: "Account help",
    bug: "Bug report",
    general: "General inquiry",
  } as Record<ReportCategory, string>,

  fieldTitle: "Subject",
  fieldTitlePlaceholder: "Short summary",
  fieldBody: "Details",
  fieldBodyPlaceholder:
    "What happened, what you expected, when, and any relevant URLs. For refunds, please include the rough date of purchase.",
  fieldEmail: "Your email",
  fieldEmailPlaceholder: "you@example.com",
  emailHintRequired: "Required so we can reply.",
  emailHintOptional:
    "Optional. Reports are accepted anonymously, but a reply needs an address.",
  fieldImage: "Screenshot (optional, max 2MB)",
  imageHelp: "PNG, JPEG, WebP, or GIF.",
  imageRemove: "Remove image",
  submit: "Send",
  submitting: "Sending…",
  successMsg:
    "✓ Message received. We'll reply within 3 business days if you left an email.",
  errorPrefix: "Failed:",

  securityRefHeading: "For security researchers",
  securityRefBody:
    "If you're reporting a vulnerability, the sections below describe what's in scope and the safe-harbor policy we operate under.",

  scopeTitle: "Scope",
  scopeInLabel: "In scope",
  scopeOutLabel: "Out of scope",
  scopeIn: [
    "earprint.kwanho.dev (web app)",
    "All /api/* endpoints",
    "The Chrome extension (id: nfhgnpjhiencoajdfdadegnfbbhfjjkj)",
  ],
  scopeOut: [
    "Third-party providers (Cloudflare, Neon, Google, Lemon Squeezy, Resend, Deezer, Last.fm) — please report directly to them",
    "Denial of service or volumetric attacks",
    "Issues that require physical access to a victim's device",
    "Social-engineering attacks against project maintainers",
  ],

  safeHarborTitle: "Safe harbor",
  safeHarborBody:
    "If you research a vulnerability in good faith, we won't pursue legal action — provided you:",
  safeHarborRules: [
    "Only test against accounts you own.",
    "Don't access, modify, or download other users' data.",
    "Don't disrupt the service (no DoS, no rate-limit abuse).",
    "Give us 90 days, or until a fix ships, before any public disclosure.",
    "Report through this form (or another reasonable private channel) before going public.",
  ],
  safeHarborTail:
    "Acting outside these limits — even with good intent — falls outside the safe harbor and may force us to take protective action.",

  slaTitle: "Response time",
  slaBody:
    "We aim to acknowledge within 3 business days, give a substantive first response within 7, and share a timeline once we understand the issue. Refund-related messages are prioritised.",
};

const ko: typeof en = {
  pageTitle: "지원 및 신고",
  intro:
    "환불 문의, 계정 관련 문제, 버그 신고, 보안 취약점 제보 또는 일반 피드백 모두 운영자 메일함으로 전달됩니다. 카테고리를 선택해 주시면 보다 신속하게 답변드릴 수 있습니다.",

  reportTitle: "메시지 전송",
  reportDesc:
    "전송된 메시지는 운영자 메일함으로 직접 전달됩니다. 본 페이지에 개인 이메일을 노출하지 않습니다.",

  fieldCategory: "문의 유형",
  categories: {
    security: "보안 취약점 신고",
    billing: "결제 및 환불 문의",
    account: "계정 관련 문의",
    bug: "버그 신고",
    general: "일반 문의",
  } as Record<ReportCategory, string>,

  fieldTitle: "제목",
  fieldTitlePlaceholder: "내용을 한 줄로 요약해 주세요",
  fieldBody: "상세 내용",
  fieldBodyPlaceholder:
    "발생한 상황, 기대했던 동작, 발생 시각, 관련 URL 등을 작성해 주세요. 환불 문의 시 결제 시점을 함께 알려주시면 처리가 빠릅니다.",
  fieldEmail: "회신용 이메일",
  fieldEmailPlaceholder: "you@example.com",
  emailHintRequired: "회신을 위해 이메일이 필요합니다.",
  emailHintOptional:
    "선택 입력입니다. 보안 신고는 익명으로도 접수 가능하지만, 답변이 필요하시면 이메일을 남겨주시기 바랍니다.",
  fieldImage: "스크린샷 (선택, 최대 2MB)",
  imageHelp: "PNG · JPEG · WebP · GIF 지원.",
  imageRemove: "이미지 제거",
  submit: "전송",
  submitting: "전송 중…",
  successMsg:
    "✓ 메시지가 정상 접수되었습니다. 회신용 이메일을 남기셨다면 영업일 기준 3일 이내 답변드리겠습니다.",
  errorPrefix: "실패:",

  securityRefHeading: "보안 연구자 참고 사항",
  securityRefBody:
    "보안 취약점을 신고하시는 경우, 아래 신고 범위와 면책 조항을 확인해 주시기 바랍니다.",

  scopeTitle: "신고 범위",
  scopeInLabel: "포함",
  scopeOutLabel: "제외",
  scopeIn: [
    "earprint.kwanho.dev (웹 애플리케이션)",
    "/api/* 전체 엔드포인트",
    "Chrome 확장 프로그램 (id: nfhgnpjhiencoajdfdadegnfbbhfjjkj)",
  ],
  scopeOut: [
    "제3자 서비스 제공자 (Cloudflare · Neon · Google · Lemon Squeezy · Resend · Deezer · Last.fm) — 해당 업체에 직접 신고해 주시기 바랍니다",
    "서비스 거부 공격 (DoS) 및 대량 트래픽 공격",
    "피해자 기기에 물리적 접근이 필요한 이슈",
    "운영자를 대상으로 한 사회공학적 공격",
  ],

  safeHarborTitle: "면책 (Safe Harbor)",
  safeHarborBody:
    "다음 원칙을 준수하며 선의로 보안 연구를 진행하시는 경우, 운영자는 법적 책임을 묻지 않습니다.",
  safeHarborRules: [
    "본인 소유 계정에서만 테스트를 진행할 것.",
    "타 이용자의 데이터에 접근·수정·다운로드하지 않을 것.",
    "서비스 운영에 지장을 주지 않을 것 (DoS 및 과도한 호출 금지).",
    "신고 후 90일 또는 수정이 완료된 시점 중 빠른 시점까지 공개를 유보할 것.",
    "본 신고 폼 또는 그 밖의 합리적인 비공개 채널을 통해 먼저 알릴 것.",
  ],
  safeHarborTail:
    "위 범위를 벗어난 행위는 선의 여부와 무관하게 면책 대상에서 제외되며, 운영자가 보호 조치를 취할 수 있습니다.",

  slaTitle: "응답 시간",
  slaBody:
    "영업일 기준 3일 이내 접수 확인, 7일 이내 1차 답변을 목표로 합니다. 이슈 파악이 끝나는 대로 후속 일정을 공유드립니다. 환불 관련 문의는 우선적으로 처리됩니다.",
};

export function securityDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
