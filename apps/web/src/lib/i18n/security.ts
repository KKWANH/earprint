import type { Locale } from "../i18n";

const en = {
  pageTitle: "Security & responsible disclosure",
  intro:
    "If you find a vulnerability in Earprint, please tell us privately first. We're a small team and we appreciate the heads-up; we'll respond fast.",

  reportTitle: "Report a vulnerability",
  reportDesc:
    "Use the form below — your report lands directly in our maintainer inbox. No personal email addresses are exposed publicly.",
  fieldTitle: "Title",
  fieldTitlePlaceholder: "Short summary of the issue",
  fieldBody: "Details",
  fieldBodyPlaceholder:
    "Steps to reproduce, expected vs actual behaviour, severity, any relevant URLs. Markdown is fine.",
  fieldEmail: "Your email (optional, for reply)",
  fieldEmailPlaceholder: "you@example.com",
  fieldImage: "Screenshot (optional, max 2MB)",
  imageHelp: "PNG, JPEG, WebP, or GIF.",
  imageRemove: "Remove image",
  submit: "Send report",
  submitting: "Sending…",
  successMsg: "✓ Report received. We'll reply within 3 business days if you left an email.",
  errorPrefix: "Failed:",

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
    "Acting in good faith — testing only on accounts you own, not exfiltrating data, giving us reasonable time to respond before public disclosure — will not result in legal action from us.",

  slaTitle: "Response time",
  slaBody:
    "Acknowledgement within 3 business days. Triage + initial assessment within 7. Fix or mitigation timeline shared once severity is understood.",
};

const ko: typeof en = {
  pageTitle: "보안 취약점 신고",
  intro:
    "Earprint 에서 취약점을 발견하셨다면 비공개로 먼저 알려주시기 바랍니다. 소규모 팀이 운영하지만 신속하게 대응하겠습니다.",

  reportTitle: "취약점 신고하기",
  reportDesc:
    "아래 폼으로 제출해 주시면 운영자 메일함으로 직접 전달됩니다. 본 페이지에 개인 이메일을 노출하지 않습니다.",
  fieldTitle: "제목",
  fieldTitlePlaceholder: "취약점을 한 줄로 요약해 주세요",
  fieldBody: "상세 내용",
  fieldBodyPlaceholder:
    "재현 절차, 기대 동작과 실제 동작, 심각도, 관련 URL 등을 작성해 주세요. 마크다운 사용 가능.",
  fieldEmail: "회신용 이메일 (선택)",
  fieldEmailPlaceholder: "you@example.com",
  fieldImage: "스크린샷 (선택, 최대 2MB)",
  imageHelp: "PNG · JPEG · WebP · GIF 지원.",
  imageRemove: "이미지 제거",
  submit: "신고 전송",
  submitting: "전송 중…",
  successMsg: "✓ 접수 완료. 회신용 이메일을 남기셨다면 영업일 기준 3일 이내 답변드리겠습니다.",
  errorPrefix: "실패:",

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

  safeHarborTitle: "면책 (Safe harbor)",
  safeHarborBody:
    "선의로 행동하시는 한 — 본인 소유 계정에서만 테스트, 데이터 유출 금지, 공개 전 합리적 대응 기간 제공 — 운영자는 법적 조치를 취하지 않습니다.",

  slaTitle: "응답 시간",
  slaBody:
    "영업일 기준 3일 이내 접수 확인, 7일 이내 1차 트리아지를 진행합니다. 심각도가 파악되면 수정 또는 완화 일정을 공유드립니다.",
};

export function securityDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
