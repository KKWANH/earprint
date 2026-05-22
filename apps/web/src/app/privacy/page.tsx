import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export const metadata: Metadata = { title: "Privacy Policy — Earprint" };

const CONTACT = "kwanho0096@gmail.com";

const en = {
  title: "Privacy Policy",
  updated: "Last updated: May 22, 2026",
  sections: [
    {
      heading: "Who we are",
      body: [
        "Earprint is a personal, educational project that turns your YouTube Music liked songs into an analysis of your music taste. This policy explains what we collect and why.",
      ],
    },
    {
      heading: "What we collect",
      body: [
        "Account information — your email address and name, provided by Google when you sign in.",
        "Music data — the songs you marked as “liked” on YouTube Music (title, artist, album). This list is collected from your own logged-in session by the Earprint Chrome extension and uploaded to your account.",
        "Your activity in Earprint — the ratings and optional notes you give to recommendations.",
      ],
    },
    {
      heading: "How we use it",
      body: [
        "Your data is used solely to analyze your music taste and produce your library dashboard, Taste DNA, psychology profile and recommendations. We do not sell your data and we do not use it for advertising.",
      ],
    },
    {
      heading: "Third-party services",
      body: [
        "Google — sign-in and authentication.",
        "Deezer, Last.fm and MusicBrainz — song and artist names are sent to fetch album art, previews and metadata.",
        "Google Gemini — song titles, artists and aggregate statistics are sent to generate the AI analysis. Your email and identity are not sent.",
        "Resend — delivers your analysis-summary email.",
        "Neon (database) and Cloudflare (hosting) — store and serve the application.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "We use a sign-in session cookie and a cookie that remembers your language preference. We do not use advertising or third-party tracking cookies.",
      ],
    },
    {
      heading: "Data retention and your rights",
      body: [
        "Your data is kept while your account exists. You can delete your account and all associated data at any time from within the app, or by contacting us.",
      ],
    },
    {
      heading: "Children",
      body: ["Earprint is not directed to children under 14."],
    },
    {
      heading: "Changes",
      body: [
        "We may update this policy. The “last updated” date above reflects the current version.",
      ],
    },
    {
      heading: "Contact",
      body: [`Questions about this policy: ${CONTACT}`],
    },
  ] as LegalSection[],
};

const ko: typeof en = {
  title: "개인정보처리방침",
  updated: "최종 수정일: 2026년 5월 22일",
  sections: [
    {
      heading: "서비스 소개",
      body: [
        "Earprint 는 유튜브 뮤직 좋아요 곡을 음악 취향 분석으로 바꿔 주는 개인용·교육용 프로젝트입니다. 본 방침은 어떤 정보를 왜 수집하는지 설명합니다.",
      ],
    },
    {
      heading: "수집하는 정보",
      body: [
        "계정 정보 — Google 로그인 시 제공되는 이메일 주소와 이름.",
        "음악 데이터 — 유튜브 뮤직에서 “좋아요”한 곡(제목·아티스트·앨범). 이 목록은 Earprint 크롬 확장프로그램이 사용자 본인의 로그인 세션에서 수집해 계정에 업로드합니다.",
        "이용 활동 — 추천에 매긴 평가와 선택적으로 남긴 메모.",
      ],
    },
    {
      heading: "정보의 이용",
      body: [
        "수집한 정보는 오직 음악 취향을 분석해 라이브러리 대시보드·취향 DNA·심리분석·추천을 생성하는 데에만 사용됩니다. 데이터를 판매하지 않으며 광고에 사용하지 않습니다.",
      ],
    },
    {
      heading: "제3자 서비스",
      body: [
        "Google — 로그인 및 인증.",
        "Deezer·Last.fm·MusicBrainz — 앨범 아트·미리듣기·메타데이터를 가져오기 위해 곡·아티스트명을 전송합니다.",
        "Google Gemini — AI 분석 생성을 위해 곡 제목·아티스트·통계 요약을 전송합니다. 이메일·신원 정보는 전송하지 않습니다.",
        "Resend — 분석 요약 메일을 발송합니다.",
        "Neon(데이터베이스)·Cloudflare(호스팅) — 애플리케이션을 저장·서빙합니다.",
      ],
    },
    {
      heading: "쿠키",
      body: [
        "로그인 세션 쿠키와 언어 설정을 기억하는 쿠키를 사용합니다. 광고·제3자 추적 쿠키는 사용하지 않습니다.",
      ],
    },
    {
      heading: "데이터 보관 및 이용자 권리",
      body: [
        "데이터는 계정이 유지되는 동안 보관됩니다. 앱 내에서 또는 문의를 통해 언제든지 계정과 관련 데이터 전체를 삭제할 수 있습니다.",
      ],
    },
    {
      heading: "아동",
      body: ["Earprint 는 만 14세 미만 아동을 대상으로 하지 않습니다."],
    },
    {
      heading: "변경",
      body: ["본 방침은 변경될 수 있으며, 위 “최종 수정일”이 현재 버전을 나타냅니다."],
    },
    {
      heading: "문의",
      body: [`본 방침 관련 문의: ${CONTACT}`],
    },
  ],
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  const d = locale === "ko" ? ko : en;
  return <LegalDoc title={d.title} updated={d.updated} sections={d.sections} />;
}
