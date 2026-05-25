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
    period: "forever",
    cta: "Current plan",
    features: [
      "Liked-song sync (Chrome extension + mobile API)",
      "Library dashboard · top artists / genres / moods",
      "Music Zodiac portrait",
      "1 AI music-psychology profile per day",
      "Library size up to 500 tracks",
      "Public share page (default theme)",
    ],
  },

  pro: {
    name: "Pro",
    badge: "Best value · $25 once",
    monthly: "$3 / month",
    lifetime: "$25 once",
    monthlyCta: "Upgrade — $3/month",
    lifetimeCta: "Lifetime — $25",
    perks: [
      "Unlimited AI profile regeneration (skip the queue)",
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
  tagline: "Earprint 의 핵심 분석은 무료입니다. Pro 는 일일 한도를 풀고 더 무거운 기능들을 열어줍니다.",
  comingSoon:
    "결제 기능은 아직 오픈 전입니다 — 현재 이 페이지는 미리보기이고, 모든 기능은 모두에게 열려있습니다.",

  free: {
    name: "Free",
    price: "$0",
    period: "영구",
    cta: "현재 플랜",
    features: [
      "좋아요 곡 동기화 (크롬 확장 + 모바일 API)",
      "라이브러리 대시보드 · 자주 듣는 아티스트/장르/무드",
      "음악 별자리 프로필",
      "AI 심리분석 하루 1회",
      "라이브러리 최대 500곡",
      "공개 공유 페이지 (기본 테마)",
    ],
  },

  pro: {
    name: "Pro",
    badge: "가성비 · $25 한번",
    monthly: "$3 / 월",
    lifetime: "$25 한번",
    monthlyCta: "월구독 $3 시작",
    lifetimeCta: "평생 $25 결제",
    perks: [
      "AI 분석 무제한 재생성 (대기열 우선)",
      "라이브러리 무제한 (2,000곡+)",
      "곡별 상세 분석 (모든 곡의 장르·무드·오디오 특성)",
      "공유 페이지 커스텀 경로 + 별자리 테마 6종",
      "우선 메일 지원",
      "언제든 해지 가능",
    ],
  },

  comparison: {
    title: "어떻게 다른가요",
    rows: [
      { feature: "좋아요 곡 동기화", free: "✓", pro: "✓" },
      { feature: "자주 듣는 아티스트/장르/무드", free: "✓", pro: "✓" },
      { feature: "음악 별자리", free: "✓", pro: "✓" },
      { feature: "공유 페이지", free: "기본 테마", pro: "6 테마 + 커스텀 경로" },
      { feature: "곡별 상세 분석", free: "처음 100곡", pro: "무제한" },
      { feature: "AI 프로필 재생성", free: "1회/일", pro: "무제한" },
      { feature: "라이브러리 크기", free: "최대 500곡", pro: "무제한" },
    ],
  },

  faqTitle: "자주 묻는 것",
  faq: [
    {
      q: "해지할 수 있나요?",
      a: "네, 언제든. 월구독은 결제한 기간이 끝날 때까지 유지되고, 평생 구매는 일회성입니다.",
    },
    {
      q: "환불은요?",
      a: "저희 측에 문제가 있으면 메일 주세요. 실제 환불 처리는 Lemon Squeezy (결제 대행사) 가 합니다.",
    },
    {
      q: "왜 이렇게 저렴한가요?",
      a: "Earprint 는 사이드 프로젝트입니다 — Gemini API 비용과 약간의 운영비를 충당하는 정도예요. 돈이 목적이 아닙니다.",
    },
    {
      q: "다운그레이드하면 데이터가 사라지나요?",
      a: "아니요. 다운그레이드해도 동기화한 라이브러리·분석·AI 프로필은 그대로. 새로운 액션에만 무료 한도가 적용됩니다.",
    },
  ],
};

export function pricingDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
