import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export const metadata: Metadata = { title: "Terms of Service — Earprint" };

const CONTACT = "kwanho0096@gmail.com";

const en = {
  title: "Terms of Service",
  updated: "Last updated: May 22, 2026",
  sections: [
    {
      heading: "About the service",
      body: [
        "Earprint is a personal, educational project that analyzes your YouTube Music liked songs. It is provided free of charge. By using Earprint you agree to these terms.",
      ],
    },
    {
      heading: "Using the service",
      body: [
        "You sign in with your own Google account and collect only your own YouTube Music data through the Earprint Chrome extension. Do not use Earprint to access data that is not yours, or to disrupt or abuse the service.",
      ],
    },
    {
      heading: "No affiliation",
      body: [
        "Earprint is not affiliated with, endorsed by, or sponsored by Google, YouTube, Deezer, Last.fm or MusicBrainz. YouTube Music has no public API; the extension reads only your own logged-in session.",
      ],
    },
    {
      heading: "Provided “as is”",
      body: [
        "The service is provided “as is”, without warranty of any kind. Analysis results are estimates and may be inaccurate — YouTube Music data is incomplete and the analysis is generated automatically.",
      ],
    },
    {
      heading: "Availability",
      body: [
        "We may change, suspend or discontinue the service, in whole or in part, at any time.",
      ],
    },
    {
      heading: "Limitation of liability",
      body: [
        "To the maximum extent permitted by law, we are not liable for any damages arising from your use of, or inability to use, the service.",
      ],
    },
    {
      heading: "Governing law",
      body: ["These terms are governed by the laws of the Republic of Korea."],
    },
    {
      heading: "Contact",
      body: [`Questions about these terms: ${CONTACT}`],
    },
  ] as LegalSection[],
};

const ko: typeof en = {
  title: "이용약관",
  updated: "최종 수정일: 2026년 5월 22일",
  sections: [
    {
      heading: "서비스 소개",
      body: [
        "Earprint 는 유튜브 뮤직 좋아요 곡을 분석하는 개인용·교육용 프로젝트이며 무료로 제공됩니다. Earprint 를 이용함으로써 본 약관에 동의하게 됩니다.",
      ],
    },
    {
      heading: "서비스 이용",
      body: [
        "사용자는 본인의 Google 계정으로 로그인하고, Earprint 크롬 확장프로그램을 통해 본인의 유튜브 뮤직 데이터만 수집합니다. 본인의 것이 아닌 데이터에 접근하거나 서비스를 방해·악용하는 용도로 사용해서는 안 됩니다.",
      ],
    },
    {
      heading: "비제휴 고지",
      body: [
        "Earprint 는 Google·YouTube·Deezer·Last.fm·MusicBrainz 와 제휴·보증·후원 관계가 없습니다. 유튜브 뮤직은 공개 API 가 없으며, 확장프로그램은 사용자 본인의 로그인 세션만 읽습니다.",
      ],
    },
    {
      heading: "“있는 그대로” 제공",
      body: [
        "서비스는 어떠한 보증도 없이 “있는 그대로” 제공됩니다. 분석 결과는 추정치이며 부정확할 수 있습니다 — 유튜브 뮤직 데이터는 불완전하고 분석은 자동 생성됩니다.",
      ],
    },
    {
      heading: "서비스 제공",
      body: [
        "서비스의 전부 또는 일부를 언제든지 변경·중단·종료할 수 있습니다.",
      ],
    },
    {
      heading: "책임의 제한",
      body: [
        "법이 허용하는 최대 범위에서, 서비스 이용 또는 이용 불가로 발생한 어떠한 손해에 대해서도 책임지지 않습니다.",
      ],
    },
    {
      heading: "준거법",
      body: ["본 약관은 대한민국 법률에 따릅니다."],
    },
    {
      heading: "문의",
      body: [`본 약관 관련 문의: ${CONTACT}`],
    },
  ],
};

export default async function TermsPage() {
  const locale = await getLocale();
  const d = locale === "ko" ? ko : en;
  return <LegalDoc title={d.title} updated={d.updated} sections={d.sections} />;
}
