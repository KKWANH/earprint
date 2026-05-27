import type { Locale } from "../i18n";

/**
 * Strings for the public /security page.
 *
 * The page used to host an in-app contact form that POSTed to
 * /api/security/report and emailed the maintainer via Resend. The Resend
 * dependency was removed (KR users hit deliverability issues, sandbox
 * domain limits, and the operator preferred direct mailto: anyway).
 *
 * The page is now a static contact card: mailto: + GitHub Issues link,
 * plus the existing scope / safe-harbor / SLA reference text that
 * security researchers actually read.
 */

const en = {
  pageTitle: "Security & contact",
  intro:
    "Reach the maintainer directly for security disclosures, bug reports, account or billing questions, and general feedback. Security-vulnerability reports are triaged first.",

  contactCardTitle: "How to reach us",
  contactCardBody:
    "Drop a line at the address below. Include the category in the subject so we can triage faster — e.g. [Security] / [Billing] / [Account] / [Bug] / [General].",
  contactEmailLabel: "Email the maintainer",
  contactGithubLabel: "Open an issue on GitHub",
  contactGithubHint: "Bug reports, feature requests, and code-level questions are easier to track here.",

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
    "Third-party providers (Cloudflare, Neon, Google, Lemon Squeezy, Deezer, Last.fm) — please report directly to them",
    "Denial of service or volumetric attacks",
    "Issues that require physical access to a victim's device",
    "Social-engineering attacks against project maintainers",
  ],

  safeHarborTitle: "Safe harbor",
  safeHarborBody:
    "Earprint supports good-faith security research. If your testing follows this policy and stays within the scope above, we will not initiate a legal complaint against you for the research activity itself, unless required to by applicable law or by a third-party platform whose terms we are bound by. \"Good faith\" means: you were trying to find and report a vulnerability, you stopped at the minimum proof-of-concept needed to demonstrate it, and you contacted us before going public. To stay within this policy:",
  safeHarborRules: [
    "Test only against accounts you own. If a flaw inherently requires touching another account, stop and describe it to us — don't actually demonstrate it.",
    "Never access, modify, retain, or download other users' data. Stop the moment you realise a request would expose data that isn't yours, and tell us what you saw.",
    "Don't degrade service availability for other users — no DoS, no volumetric scans, no automated rate-limit hammering. A handful of curl calls to confirm a finding is fine; a 10k-request fuzzer isn't.",
    "Give us a reasonable opportunity to investigate and fix before public disclosure — 90 days from your first report or until a fix ships, whichever comes first. We will keep you informed of progress and credit you publicly if you wish.",
    "Report through the email or GitHub channel above, or another reasonable private channel, before any public disclosure or third-party submission (Twitter, blog, full-disclosure list, etc.).",
    "Don't deploy backdoors, persistence mechanisms, or anything that would harm us or other users to demonstrate impact.",
  ],
  safeHarborTail:
    "Activities outside these limits — even with good intent — fall outside this policy and may require us to take protective action. If you are unsure whether something is in scope, ask first.",

  slaTitle: "Response time",
  slaBody:
    "We aim to acknowledge within 3 business days and give a substantive first response within 7. Security-vulnerability reports are triaged first — anything we believe could affect user data, account access, or payment integrity is escalated within 24 hours and patched before public disclosure. Refund and account messages follow the standard queue.",
};

const ko: typeof en = {
  pageTitle: "보안 및 문의",
  intro:
    "보안 취약점 제보, 버그 신고, 계정·결제 관련 문의, 일반 피드백 등 무엇이든 운영자에게 직접 보내주세요. 보안 취약점 신고는 최우선으로 처리합니다.",

  contactCardTitle: "연락 방법",
  contactCardBody:
    "아래 주소로 메일을 보내주세요. 제목에 카테고리를 함께 적어주시면 트리아지가 빨라집니다 — 예: [Security] / [Billing] / [Account] / [Bug] / [General].",
  contactEmailLabel: "운영자에게 메일",
  contactGithubLabel: "GitHub 이슈 등록",
  contactGithubHint: "버그 신고·기능 요청·코드 레벨 질문은 여기가 추적하기 더 편합니다.",

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
    "제3자 서비스 제공자 (Cloudflare · Neon · Google · Lemon Squeezy · Deezer · Last.fm) — 해당 업체에 직접 신고해 주시기 바랍니다",
    "서비스 거부 공격 (DoS) 및 대량 트래픽 공격",
    "피해자 기기에 물리적 접근이 필요한 이슈",
    "운영자를 대상으로 한 사회공학적 공격",
  ],

  safeHarborTitle: "면책 (Safe Harbor)",
  safeHarborBody:
    "Earprint 는 선의의 보안 연구를 지지합니다. 테스트가 본 정책과 위 신고 범위를 준수하는 경우, 운영자는 해당 연구 활동 자체에 대해 법적 청구를 제기하지 않습니다 — 다만 관계 법령이 요구하거나, 제3자 플랫폼의 약관상 운영자가 의무를 지는 경우는 예외입니다. \"선의\"란: 취약점을 찾고 신고할 목적이었을 것, 입증에 필요한 최소한의 PoC 에서 멈추었을 것, 공개 전 운영자에게 먼저 연락했을 것을 의미합니다. 본 정책 적용을 위해 다음을 준수해 주세요:",
  safeHarborRules: [
    "본인 소유 계정에서만 테스트할 것. 본질적으로 타인 계정을 건드려야 하는 결함이라면 입증을 멈추고 설명만 보내주세요 — 실제로 시연하지 마세요.",
    "타 이용자의 데이터에 접근·수정·보관·다운로드하지 말 것. 본인 것이 아닌 데이터가 노출될 가능성을 인지한 즉시 요청을 중단하고 어떤 정보를 보았는지 알려주세요.",
    "다른 이용자의 서비스 가용성을 저해하지 말 것 — DoS, 대량 스캔, 자동화된 rate-limit 우회 금지. 결함 확인을 위한 몇 회의 curl 호출은 괜찮지만, 1만 건 단위의 퍼저(fuzzer)는 안 됩니다.",
    "운영자가 조사 및 수정할 합리적 시간을 보장할 것 — 최초 신고일로부터 90일 또는 수정이 완료된 시점 중 빠른 시점까지 공개 유보. 진행 상황은 운영자가 공유하며, 원하시는 경우 공개 시 크레딧을 드립니다.",
    "공개 발표 또는 제3자 제출(Twitter, 블로그, full-disclosure 메일링 리스트 등) 전에 위 이메일 또는 GitHub 채널, 또는 그 밖의 합리적인 비공개 채널로 먼저 알릴 것.",
    "영향도 입증을 위해 백도어·지속성 메커니즘 등 운영자나 다른 이용자에게 피해를 줄 수 있는 것을 설치하지 말 것.",
  ],
  safeHarborTail:
    "위 범위를 벗어난 행위는 선의 여부와 무관하게 본 정책 적용 대상에서 제외되며, 운영자가 보호 조치를 취해야 할 수 있습니다. 어떤 행위가 범위에 포함되는지 불확실한 경우 먼저 문의해 주세요.",

  slaTitle: "응답 시간",
  slaBody:
    "영업일 기준 3일 이내 접수 확인, 7일 이내 1차 답변을 목표로 합니다. 보안 취약점 신고는 트리아지 우선순위 — 사용자 데이터·계정 접근·결제 무결성에 영향을 줄 수 있다고 판단되는 사안은 24시간 이내 격상해 공개 전 패치합니다. 환불·계정 문의는 일반 대기열에 따라 순차 응답합니다.",
};

export function securityDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
