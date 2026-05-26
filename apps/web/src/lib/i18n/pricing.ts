import type { Locale } from "../i18n";

const en = {
  pageTitle: "Pricing",
  tagline:
    "Earprint stays free for the core analysis. Pro removes the daily caps and unlocks the heavier features.",
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
    price: "$2",
    period: "one-time",
    desc: "Top up one extra AI profile generation when you want a fresh take. No subscription.",
    cta: "Buy 1 analysis — $2",
  },

  pro: {
    name: "Pro",
    badge: "Best value",
    monthly: "$5 / month",
    monthlyCta: "Upgrade — $5/month",
    perks: [
      "Unlimited AI profile regeneration",
      "Unlimited library size (2,000+ tracks)",
      "Detailed track-level analysis (genre + mood + audio feel for every song)",
      "Custom share-page slug + 6 zodiac themes",
      "Priority email support",
      "Cancel any time",
    ],
  },

  comparison: {
    title: "What's the difference?",
    rows: [
      { feature: "Liked-songs sync", free: "✓", pro: "✓" },
      { feature: "Top artists / genres / moods", free: "✓", pro: "✓" },
      { feature: "Music Zodiac", free: "✓", pro: "✓" },
      { feature: "Share page", free: "Default theme", pro: "6 themes + custom slug" },
      { feature: "Detailed per-track analysis", free: "First 100 tracks", pro: "Unlimited" },
      { feature: "AI profile regeneration", free: "1 / day", pro: "Unlimited" },
      { feature: "Library size", free: "Up to 500 tracks", pro: "Unlimited" },
    ],
  },

  faqTitle: "Common questions",
  faq: [
    {
      q: "Can I cancel?",
      a: "Yes, any time. Subscriptions stay active until the end of the period you paid for; lifetime is a one-shot purchase.",
    },
    {
      q: "Refunds?",
      a: "If something's broken on our side, email and we'll refund. Lemon Squeezy (our payment provider) handles the actual refund mechanic.",
    },
    {
      q: "Why so cheap?",
      a: "Earprint is a side project — pricing covers Gemini API costs and a little operating budget. Money isn't the point.",
    },
    {
      q: "Will my data be deleted if I downgrade?",
      a: "No. Downgrading just re-applies the free-tier caps to new actions. Your synced library, analyses and AI profile stay.",
    },
  ],
};

const ko: typeof en = {
  pageTitle: "요금제",
  tagline:
    "Earprint 의 핵심 분석은 무료로 제공됩니다. Pro 요금제는 모든 한도를 해제하고 부가 기능을 활성화합니다.",
  comingSoon:
    "결제 기능은 아직 오픈하지 않았습니다. 본 페이지는 미리보기이며, 모든 기능을 모든 이용자에게 무료로 제공하고 있습니다.",

  free: {
    name: "Free",
    price: "$0",
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
    price: "$2",
    period: "일회성 결제",
    desc: "구독 없이 AI 분석을 한 번 더 돌려보고 싶을 때 선택하시기 바랍니다.",
    cta: "1회 분석권 구매 — $2",
  },

  pro: {
    name: "Pro",
    badge: "추천",
    monthly: "$5 / 월",
    monthlyCta: "Pro 구독 시작 — $5/월",
    perks: [
      "AI 분석 무제한 재생성",
      "라이브러리 무제한 (2,000곡 이상)",
      "곡별 상세 분석 (장르·무드·오디오 특성 전곡 분석)",
      "공유 페이지 사용자 지정 URL + 별자리 테마 6종",
      "우선 메일 지원",
      "언제든 해지 가능",
    ],
  },

  comparison: {
    title: "요금제 비교",
    rows: [
      { feature: "좋아요 곡 동기화", free: "✓", pro: "✓" },
      { feature: "주요 아티스트·장르·무드", free: "✓", pro: "✓" },
      { feature: "음악 별자리", free: "✓", pro: "✓" },
      { feature: "공유 페이지", free: "기본 테마", pro: "테마 6종 + 사용자 지정 URL" },
      { feature: "곡별 상세 분석", free: "최초 100곡", pro: "무제한" },
      { feature: "AI 프로필 재생성", free: "분석권 단위", pro: "무제한" },
      { feature: "라이브러리 크기", free: "최대 500곡", pro: "무제한" },
    ],
  },

  faqTitle: "자주 묻는 질문",
  faq: [
    {
      q: "구독을 해지할 수 있나요?",
      a: "언제든 해지 가능합니다. Pro 월 구독은 결제한 기간 종료 시까지 유효하며, 자동 갱신을 중단할 수 있습니다. 1회 분석권은 일회성 결제로 별도 해지 절차가 없습니다.",
    },
    {
      q: "환불이 가능한가요?",
      a: "서비스 측 결함으로 정상 이용이 불가했던 경우 메일로 문의 주시면 환불해 드립니다. 실제 환불 처리는 결제 대행사인 Lemon Squeezy 를 통해 진행됩니다.",
    },
    {
      q: "가격을 이렇게 책정한 이유는 무엇인가요?",
      a: "Earprint 는 개인 프로젝트로 운영되고 있습니다. 책정된 금액은 Gemini API 호출 비용과 최소한의 운영비를 충당하기 위한 수준이며, 이윤이 주된 목적이 아닙니다.",
    },
    {
      q: "다운그레이드 시 데이터는 어떻게 되나요?",
      a: "데이터는 그대로 유지됩니다. 다운그레이드는 신규 액션에만 무료 플랜의 한도를 다시 적용할 뿐이며, 이미 동기화한 라이브러리·분석 결과·AI 프로필은 보존됩니다.",
    },
  ],
};

export function pricingDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
