import type { Locale } from "../i18n";

const en = {
  pageTitle: "Security & responsible disclosure",
  intro:
    "If you find a vulnerability in Earprint, please tell us privately first. We're a tiny project and we appreciate the heads-up; we'll respond fast.",
  contactTitle: "Contact",
  contactLine: "Email:",
  contactEmail: "kwanho0096@gmail.com",
  pgpNote: "PGP available on request.",
  scopeTitle: "Scope",
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
  rewardTitle: "Bounty",
  rewardBody:
    "We can't promise money but we can promise public credit (Hall of Fame) and a heartfelt thank-you. For commercially significant findings we'll discuss compensation case-by-case.",
  slaTitle: "Response time",
  slaBody:
    "Acknowledgement within 3 business days. Triage + initial assessment within 7. Fix or mitigation timeline shared once severity is understood.",
};

const ko: typeof en = {
  pageTitle: "보안 및 책임있는 취약점 신고",
  intro:
    "Earprint 에서 취약점을 발견하셨다면 먼저 비공개로 알려주세요. 소규모 프로젝트라 빠르게 대응합니다.",
  contactTitle: "연락처",
  contactLine: "이메일:",
  contactEmail: "kwanho0096@gmail.com",
  pgpNote: "PGP 키는 요청 시 제공.",
  scopeTitle: "범위",
  scopeIn: [
    "earprint.kwanho.dev (웹 앱)",
    "모든 /api/* 엔드포인트",
    "Chrome 확장 (id: nfhgnpjhiencoajdfdadegnfbbhfjjkj)",
  ],
  scopeOut: [
    "제3자 공급자 (Cloudflare, Neon, Google, Lemon Squeezy, Resend, Deezer, Last.fm) — 해당 업체에 직접 신고",
    "서비스 거부 또는 대량 공격",
    "피해자 기기에 물리적 접근이 필요한 이슈",
    "프로젝트 운영자 대상 사회공학적 공격",
  ],
  safeHarborTitle: "Safe harbor",
  safeHarborBody:
    "선의로 행동하는 한 — 본인 소유 계정에서만 테스트, 데이터 유출 금지, 공개 전 합리적 대응 시간 허용 — 법적 조치를 취하지 않습니다.",
  rewardTitle: "보상",
  rewardBody:
    "금전 보상은 약속 못 드리지만 공개 크레딧(Hall of Fame) 과 진심 어린 감사. 상업적으로 의미 있는 발견은 케이스 별로 보상 협의.",
  slaTitle: "응답 시간",
  slaBody:
    "영업일 기준 3일 이내 접수 확인. 7일 이내 1차 트리아지. 심각도 파악 후 수정·완화 일정 공유.",
};

export function securityDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
