import type { Locale } from "../i18n";

/**
 * Pricing i18n.
 *
 * Two SKUs only: Free + Single Analysis. The Pro monthly subscription
 * was paused — without an analysis-history feature ("did my taste
 * change since last month?") there's no real reason to ask for a
 * recurring charge. It comes back once history lands.
 *
 * Prices: KR sees ₩2,500 / EN sees $1.99 — same Lemon Squeezy SKU,
 * display follows locale. Settled in USD by the payment provider.
 */

const en = {
  pageTitle: "Pricing",
  tagline:
    "Earprint stays free for the core analysis. Pay once per extra AI profile when you want a fresh run — no subscription.",
  comingSoon:
    "Payments aren't open yet — this page is a preview. Everything is currently unlocked for everyone.",

  free: {
    name: "Free",
    price: "$0",
    period: "starter",
    cta: "Current plan",
    features: [
      "Liked-song sync (Chrome extension + mobile API)",
      "Library dashboard · top artists / genres / moods",
      "Music Zodiac portrait",
      "1 AI music-psychology profile (the starter credit)",
      "Library size up to 500 tracks",
      "Public share page (default theme)",
    ],
  },

  analysis: {
    name: "Single Analysis",
    price: "$1.99",
    period: "one-time",
    desc: "Top up one extra AI profile generation when you want a fresh take on your taste — AND lifts the 500-track sync cap permanently. No subscription, no recurring charge.",
    cta: "Buy 1 analysis — $1.99",
  },

  triple: {
    name: "3-Pack",
    price: "$3.99",
    period: "one-time",
    saveLabel: "~33% off vs. singles",
    desc: "Three analysis credits in a bundle + the same lifetime sync-cap lift as the single. Sit on them and run a fresh profile every couple of months as your taste shifts.",
    cta: "Buy 3-pack — $3.99",
  },

  comparison: {
    title: "What's included",
    rows: [
      { feature: "Liked-songs sync", free: "Up to 500 tracks", paid: "Unlimited (lifetime)" },
      { feature: "Library dashboard · top artists / genres / moods", free: "✓", paid: "✓" },
      { feature: "Music Zodiac portrait", free: "✓", paid: "✓" },
      { feature: "Taste DNA · Artist Map · Recommendations · Worldcup", free: "✓", paid: "✓" },
      { feature: "AI music-psychology profile", free: "1 starter", paid: "+1 per purchase" },
      { feature: "Public share page", free: "Default theme", paid: "Default theme" },
    ],
  },

  faqTitle: "Common questions",
  faq: [
    {
      q: "Why per-analysis instead of subscription?",
      a: "Earprint is a report-style product — most people want to run an analysis when their taste has actually moved, not once a month. Per-analysis pricing lines up with how the product gets used.",
    },
    {
      q: "Refunds?",
      a: "If something's broken on our side, email at the address on the /security page and we'll refund. Lemon Squeezy (our payment provider) handles the actual refund mechanic.",
    },
    {
      q: "Why so cheap?",
      a: "Earprint is a side project — pricing covers the Gemini API cost per analysis (~$0.014) plus the payment fees, with a little headroom. Volume isn't the point yet.",
    },
    {
      q: "Will my data be deleted if I stop buying analyses?",
      a: "No. Your library, past analyses, and zodiac result stay. The credit just gates running a new AI profile — everything else (library dashboard, share page, worldcup, etc.) keeps working.",
    },
    {
      q: "Will there be a subscription option later?",
      a: "When the analysis-history feature lands — being able to compare 'May vs August' versions of your taste — a monthly subscription will make sense. Until then it's pay-as-you-go.",
    },
  ],
};

const ko: typeof en = {
  pageTitle: "요금제",
  tagline:
    "Earprint 의 핵심 분석은 무료로 제공됩니다. 새로 분석을 한 번 더 돌리고 싶을 때만 1회 결제 — 구독 없음.",
  comingSoon:
    "결제 기능은 아직 오픈하지 않았습니다. 본 페이지는 미리보기이며, 모든 기능을 모든 이용자에게 무료로 제공하고 있습니다.",

  free: {
    name: "Free",
    price: "₩0",
    period: "시작 플랜",
    cta: "현재 플랜",
    features: [
      "좋아요 곡 동기화 (Chrome 확장 또는 모바일 API)",
      "라이브러리 대시보드 — 주요 아티스트·장르·무드",
      "음악 별자리 프로필",
      "AI 음악 심리분석 1회 (시작 크레딧 제공)",
      "라이브러리 최대 500곡",
      "공개 공유 페이지 (기본 테마)",
    ],
  },

  analysis: {
    name: "1회 분석권",
    price: "₩2,500",
    period: "일회성 결제",
    desc: "AI 분석 한 번 더 + 500곡 동기화 제한 영구 해제. 구독 없이 일회성, 한 번만 결제하면 라이브러리 무제한 sync 가능.",
    cta: "1회 분석권 구매 — ₩2,500",
  },

  triple: {
    name: "3회 분석권",
    price: "₩5,000",
    period: "일회성 결제",
    saveLabel: "1회권 대비 약 33% 할인",
    desc: "AI 분석 크레딧 3회 + 1회권과 동일한 500곡 동기화 제한 영구 해제. 몇 달에 한 번씩 돌려보고 싶을 때.",
    cta: "3회권 구매 — ₩5,000",
  },

  comparison: {
    title: "포함 내역",
    rows: [
      { feature: "좋아요 곡 동기화", free: "최대 500곡", paid: "무제한 (영구)" },
      { feature: "라이브러리 대시보드 · 주요 아티스트·장르·무드", free: "✓", paid: "✓" },
      { feature: "Music Zodiac 별자리 프로필", free: "✓", paid: "✓" },
      { feature: "Taste DNA · Artist Map · Recommendations · Worldcup", free: "✓", paid: "✓" },
      { feature: "AI 음악 심리분석", free: "시작 1회", paid: "결제 시 +1회" },
      { feature: "공개 공유 페이지", free: "기본 테마", paid: "기본 테마" },
    ],
  },

  faqTitle: "자주 묻는 질문",
  faq: [
    {
      q: "왜 구독이 아니라 1회 결제인가요?",
      a: "Earprint 는 리포트형 제품입니다 — 매달 분석하는 게 아니라, 취향이 실제로 변했을 때 한 번 돌려보는 사용 패턴. 1회 결제가 실제 사용 흐름과 더 잘 맞습니다.",
    },
    {
      q: "환불이 가능한가요?",
      a: "서비스 측 결함으로 정상 이용이 불가했던 경우 /security 페이지의 이메일로 문의 주시면 환불해 드립니다. 실제 환불 처리는 결제 대행사인 Lemon Squeezy 를 통해 진행됩니다.",
    },
    {
      q: "가격을 이렇게 책정한 이유는 무엇인가요?",
      a: "Earprint 는 개인 프로젝트입니다. 가격은 분석 1회당 Gemini API 비용 (약 $0.014) + 결제 수수료를 충당하고 약간의 운영 여유를 두는 수준이며, 이윤 극대화가 목적이 아닙니다.",
    },
    {
      q: "분석권을 더 안 사면 데이터가 사라지나요?",
      a: "아니요. 라이브러리·과거 분석·별자리 결과는 그대로 유지됩니다. 분석권은 새 AI 프로필을 추가로 생성할 때만 차감되며, 그 외 기능 (대시보드·공유 페이지·월드컵 등) 은 그대로 사용 가능합니다.",
    },
    {
      q: "나중에 구독 옵션이 생기나요?",
      a: "분석 히스토리 기능 (5월 vs 8월 취향 비교) 이 들어오면 월 구독이 의미를 갖게 됩니다. 그때까지는 1회 결제로만 운영합니다.",
    },
  ],
};

export function pricingDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
