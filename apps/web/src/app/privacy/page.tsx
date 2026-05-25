import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `${locale === "ko" ? "개인정보처리방침" : "Privacy Policy"} — Earprint`,
  };
}

const CONTACT = "kwanho0096@gmail.com";

const en = {
  title: "Privacy Policy",
  updated: "Last updated: May 25, 2026",
  sections: [
    {
      heading: "Introduction",
      body: [
        "This Privacy Policy explains how the operator of Earprint (the “Operator”, “we”, “us”) collects, uses, discloses, retains, and protects personal information in connection with the Earprint website and browser extension (collectively, the “Service”). It forms part of, and should be read together with, the Terms of Service.",
        "The Operator acts as the controller of the personal information processed through the Service. By using the Service you acknowledge the practices described in this Policy. Where the Service relies on your consent, that consent is obtained separately and may be withdrawn at any time.",
      ],
    },
    {
      heading: "Information we collect",
      body: [
        "(a) Account information — when you sign in, Google provides us with your email address, your display name, and a Google account identifier.",
        "(b) Music data — the songs you have marked as “liked” on YouTube Music, including title, artist, and album. This list is collected from your own logged-in session by the Earprint browser extension and uploaded to your account.",
        "(c) Activity data — the ratings and optional notes you create within the Service, and records of analyses and recommendations generated for you.",
        "(d) Payment information — if and when paid features are offered, payments are processed by a third-party payment processor. We do not collect or store your full card number, card security code, or bank credentials. We receive only limited transaction records, such as the plan purchased, amount, currency, date, payment status, and a masked payment-method reference.",
        "(e) Technical and log data — when you access the Service, our hosting and content-delivery providers automatically process technical information such as IP address, browser type, device information, and access timestamps, for security and reliability purposes.",
      ],
    },
    {
      heading: "How we use information",
      body: [
        "We use the information we collect to: (a) authenticate you and operate your account; (b) analyze your music taste and generate your dashboard, Taste DNA, psychology-style profile, artist map, and recommendations; (c) deliver the optional analysis-summary email; (d) operate, secure, maintain, and improve the Service; (e) process payments and provide customer support for paid features, if offered; and (f) comply with legal obligations.",
        "We do not sell your personal information, and we do not use it for third-party advertising or for automated decisions producing legal or similarly significant effects on you.",
        "The Operator's use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
      ],
    },
    {
      heading: "Legal basis for processing",
      body: [
        "We process your personal information on the following bases, as applicable: the performance of our contract with you (providing the Service you request); your consent (which you may withdraw at any time); compliance with legal obligations (such as retention of transaction records); and our legitimate interests in operating, securing, and improving the Service, balanced against your rights.",
      ],
    },
    {
      heading: "Disclosure to third parties and processors",
      body: [
        "We do not sell or rent personal information. We share information only with service providers that process data on our behalf, and only to the extent necessary to operate the Service:",
        "Google — authentication. Deezer, Last.fm and MusicBrainz — song and artist names are sent to retrieve album art, previews, and metadata. Google Gemini — song titles, artists, and aggregate statistics are sent to generate the AI analysis; your email address and identity are not sent. Resend — processes your email address to deliver the analysis-summary email. Neon — database hosting. Cloudflare — application hosting and content delivery. A third-party payment processor — processes payment transactions, if paid features are offered.",
        "We may also disclose information where required by law, court order, or governmental authority, or where necessary to protect the rights, safety, or property of the Operator, our users, or the public.",
      ],
    },
    {
      heading: "International transfers",
      body: [
        "Our service providers, including database and hosting providers, may process and store information on servers located outside your country of residence. Where information is transferred internationally, we take reasonable steps to ensure it remains protected in accordance with this Policy and applicable law.",
      ],
    },
    {
      heading: "Data retention",
      body: [
        "We retain account, music, and activity data for as long as your account exists. When you delete your account, this data is deleted promptly, except for information we are required to retain by law.",
        "Where paid features are offered, records relating to payments, contracts, and the withdrawal of subscriptions are retained for the periods required by applicable law — including, for the Republic of Korea, the retention periods prescribed by the Act on the Consumer Protection in Electronic Commerce (for example, records of contracts and payment for five years, and records of consumer complaints or dispute resolution for three years).",
        "Technical and log data are retained for a limited period for security and operational purposes.",
      ],
    },
    {
      heading: "Data security",
      body: [
        "We take reasonable technical and organizational measures to protect personal information against unauthorized access, alteration, disclosure, or destruction. Data is stored in a managed PostgreSQL database and transmitted over encrypted connections, and access is restricted to operating the Service.",
        "No method of transmission or storage is completely secure; we cannot guarantee absolute security.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "We use a strictly necessary sign-in session cookie to keep you authenticated, and a preference cookie that remembers your chosen language. We do not use advertising cookies or third-party tracking cookies.",
      ],
    },
    {
      heading: "Your rights and choices",
      body: [
        "Subject to applicable law, you have the right to access, correct, and delete your personal information, to object to or restrict certain processing, to data portability, and to withdraw consent at any time without affecting the lawfulness of processing carried out before withdrawal.",
        "You can delete your account and all associated data at any time from the Library page within the Service. You can revoke Earprint's access to your Google account from your Google Account settings (Security → Third-party access). For any other request, contact us using the details below; we will respond within the period required by applicable law. You may also have the right to lodge a complaint with your data-protection authority.",
      ],
    },
    {
      heading: "Children's privacy",
      body: [
        "The Service is not directed to children under the age of 14, and we do not knowingly collect personal information from them. If we become aware that we have collected such information without appropriate consent, we will delete it.",
      ],
    },
    {
      heading: "Google API Services User Data Policy — Limited Use",
      body: [
        "Earprint's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.",
        "Specifically: data accessed via Google APIs (notably the YouTube Data API v3, scope youtube.readonly) is used solely to provide and improve the user-facing music-taste analytics shown on the user's own Earprint dashboard. We do not transfer this data to others except to provide or improve user-facing features, comply with applicable law, or as part of a merger / acquisition / sale of assets with the user's explicit consent. We do not use this data for advertising. We do not allow humans to read this data unless we have your affirmative consent, it is necessary for security purposes (e.g. investigating abuse), to comply with applicable law, or the data is aggregated and used for internal operations in line with our Privacy Policy.",
      ],
    },
    {
      heading: "Changes to this Policy",
      body: [
        "We may update this Policy from time to time. Material changes will be notified through the Service or by other reasonable means before they take effect. The “last updated” date above indicates the current version.",
      ],
    },
    {
      heading: "Privacy officer and contact",
      body: [
        `For any question, request, or complaint regarding this Policy or your personal information, you may contact the person responsible for the management of personal information at ${CONTACT}.`,
        "We will make reasonable efforts to address your request without undue delay and within the period required by applicable law.",
      ],
    },
  ] as LegalSection[],
};

const ko: typeof en = {
  title: "개인정보처리방침",
  updated: "최종 수정일: 2026년 5월 25일",
  sections: [
    {
      heading: "총칙",
      body: [
        "본 개인정보처리방침은 Earprint 운영자(이하 “운영자”)가 Earprint 웹사이트 및 브라우저 확장프로그램(이하 통칭 “서비스”)과 관련하여 개인정보를 어떻게 수집·이용·제공·보관·보호하는지를 설명합니다. 본 방침은 이용약관의 일부를 구성하며 이용약관과 함께 해석됩니다.",
        "운영자는 서비스를 통해 처리되는 개인정보의 처리자(관리자)로서의 지위를 가집니다. 이용자는 서비스를 이용함으로써 본 방침에 기재된 처리 방식을 인지합니다. 서비스가 이용자의 동의에 근거하는 경우, 해당 동의는 별도로 취득되며 언제든지 철회할 수 있습니다.",
      ],
    },
    {
      heading: "수집하는 개인정보",
      body: [
        "(가) 계정 정보 — 로그인 시 Google 이 제공하는 이메일 주소, 표시 이름, Google 계정 식별자.",
        "(나) 음악 데이터 — YouTube Music 에서 “좋아요”한 곡의 제목·아티스트·앨범. 이 목록은 Earprint 확장프로그램이 이용자 본인의 로그인 세션에서 수집하여 계정에 업로드합니다.",
        "(다) 활동 데이터 — 이용자가 서비스 내에서 생성한 평가·메모, 그리고 이용자를 위해 생성된 분석·추천 기록.",
        "(라) 결제 정보 — 유료 기능이 제공되는 경우 결제는 외부 결제대행사를 통해 처리됩니다. 운영자는 카드 전체 번호·카드 보안코드·계좌 인증정보를 수집·저장하지 않으며, 구매한 플랜·금액·통화·일시·결제 상태·마스킹된 결제수단 참조정보 등 제한된 거래 기록만을 제공받습니다.",
        "(마) 기술·로그 정보 — 이용자가 서비스에 접속할 때, 호스팅 및 콘텐츠 전송 제공자가 보안·안정성 목적으로 IP 주소·브라우저 종류·기기 정보·접속 일시 등 기술 정보를 자동으로 처리합니다.",
      ],
    },
    {
      heading: "개인정보의 이용",
      body: [
        "운영자는 수집한 정보를 다음의 목적으로 이용합니다. (가) 이용자 인증 및 계정 운영, (나) 음악 취향 분석 및 대시보드·취향 DNA·심리 프로파일·아티스트 맵·추천의 생성, (다) 선택적 분석 요약 메일의 발송, (라) 서비스의 운영·보안·유지·개선, (마) 유료 기능이 제공되는 경우 결제 처리 및 고객 지원, (바) 법적 의무의 준수.",
        "운영자는 개인정보를 판매하지 않으며, 제3자 광고 또는 이용자에게 법적·중대한 영향을 미치는 자동화된 결정에 이용하지 않습니다.",
        "운영자가 Google API 로부터 받은 정보의 이용은 Google API 서비스 사용자 데이터 정책(제한적 사용 요건 포함)을 준수합니다.",
      ],
    },
    {
      heading: "처리의 법적 근거",
      body: [
        "운영자는 다음의 근거에 따라 개인정보를 처리합니다. 이용자와의 계약 이행(이용자가 요청한 서비스의 제공), 이용자의 동의(언제든지 철회 가능), 법적 의무의 준수(예: 거래기록 보존), 그리고 서비스의 운영·보안·개선에 관한 운영자의 정당한 이익(이용자의 권리와 형량).",
      ],
    },
    {
      heading: "제3자 제공 및 처리 위탁",
      body: [
        "운영자는 개인정보를 판매하거나 임대하지 않습니다. 운영자는 서비스 운영에 필요한 범위에서만, 운영자를 위하여 데이터를 처리하는 서비스 제공자에게 정보를 제공합니다.",
        "Google — 인증. Deezer·Last.fm·MusicBrainz — 앨범 아트·미리듣기·메타데이터를 가져오기 위해 곡·아티스트명 전송. Google Gemini — AI 분석 생성을 위해 곡 제목·아티스트·통계 요약 전송(이메일·신원 정보는 전송하지 않음). Resend — 분석 요약 메일 발송을 위해 이메일 주소 처리. Neon — 데이터베이스 호스팅. Cloudflare — 애플리케이션 호스팅 및 콘텐츠 전송. 외부 결제대행사 — 유료 기능 제공 시 결제 거래 처리.",
        "운영자는 법령·법원의 명령·정부기관의 요구가 있는 경우, 또는 운영자·이용자·공중의 권리·안전·재산을 보호하기 위하여 필요한 경우에도 정보를 제공할 수 있습니다.",
      ],
    },
    {
      heading: "국외 이전",
      body: [
        "데이터베이스 및 호스팅 제공자를 포함한 운영자의 서비스 제공자는 이용자의 거주 국가 외에 위치한 서버에서 정보를 처리·저장할 수 있습니다. 정보가 국외로 이전되는 경우, 운영자는 해당 정보가 본 방침과 관계 법령에 따라 보호되도록 합리적인 조치를 취합니다.",
      ],
    },
    {
      heading: "개인정보의 보유 기간",
      body: [
        "운영자는 계정·음악·활동 데이터를 이용자의 계정이 존재하는 동안 보유합니다. 이용자가 계정을 삭제하면 해당 데이터는 지체 없이 삭제됩니다. 다만 법령상 보존이 요구되는 정보는 그러하지 아니합니다.",
        "유료 기능이 제공되는 경우, 결제·계약·청약철회에 관한 기록은 관계 법령이 정하는 기간 동안 보관됩니다. 대한민국의 경우 「전자상거래 등에서의 소비자보호에 관한 법률」이 정하는 보존기간(예: 계약 및 대금결제에 관한 기록 5년, 소비자의 불만 또는 분쟁처리에 관한 기록 3년)에 따릅니다.",
        "기술·로그 정보는 보안 및 운영 목적으로 제한된 기간 동안 보관됩니다.",
      ],
    },
    {
      heading: "개인정보의 안전성 확보",
      body: [
        "운영자는 개인정보가 무단으로 접근·변경·유출·파기되지 않도록 합리적인 기술적·관리적 조치를 취합니다. 데이터는 관리형 PostgreSQL 데이터베이스에 저장되고 암호화된 연결로 전송되며, 접근 권한은 서비스 운영 목적으로 제한됩니다.",
        "다만 어떠한 전송·저장 방식도 완전하게 안전하지는 않으므로, 운영자는 절대적인 보안을 보장할 수 없습니다.",
      ],
    },
    {
      heading: "쿠키",
      body: [
        "운영자는 이용자의 로그인 상태를 유지하기 위한 필수 세션 쿠키와, 선택한 언어를 기억하는 환경설정 쿠키를 사용합니다. 광고 쿠키 또는 제3자 추적 쿠키는 사용하지 않습니다.",
      ],
    },
    {
      heading: "이용자의 권리 및 행사 방법",
      body: [
        "이용자는 관계 법령이 정하는 바에 따라 자신의 개인정보에 대한 열람·정정·삭제를 요구할 권리, 특정 처리에 대한 반대·제한을 요구할 권리, 개인정보 이동을 요구할 권리, 그리고 언제든지 동의를 철회할 권리를 가집니다. 동의 철회는 철회 이전에 이루어진 처리의 적법성에 영향을 미치지 않습니다.",
        "이용자는 서비스의 라이브러리 페이지에서 언제든지 계정과 모든 관련 데이터를 삭제할 수 있습니다. 또한 Google 계정 설정(보안 → 서드파티 액세스)에서 Earprint 의 접근 권한을 철회할 수 있습니다. 그 밖의 요청은 아래 연락처로 문의하시면 관계 법령이 정하는 기간 내에 답변드립니다. 이용자는 개인정보 보호 감독기관에 민원을 제기할 권리도 가질 수 있습니다.",
      ],
    },
    {
      heading: "아동의 개인정보",
      body: [
        "서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 운영자는 아동의 개인정보를 고의로 수집하지 않습니다. 적법한 동의 없이 그러한 정보가 수집된 사실을 인지한 경우 운영자는 이를 삭제합니다.",
      ],
    },
    {
      heading: "Google API 사용자 데이터 정책 — Limited Use",
      body: [
        "Earprint 가 Google API 로부터 받은 정보를 사용 또는 타 앱에 전송하는 행위는 Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy) 의 Limited Use 요구사항을 준수합니다.",
        "구체적으로: Google API (특히 youtube.readonly 범위로 호출되는 YouTube Data API v3) 를 통해 접근한 데이터는 오직 이용자 본인의 Earprint 대시보드에 표시되는 음악 취향 분석 기능을 제공·개선할 목적으로만 사용됩니다. 이용자 본인을 대상으로 한 기능 제공·개선, 관계 법령 준수, 이용자의 명시적 동의가 있는 합병·인수·자산매각의 경우를 제외하고 본 데이터는 타 주체에 이전되지 않습니다. 광고 목적으로 사용하지 않으며, 보안 목적의 조사·법령 준수·이용자의 명시적 동의·내부 운영을 위한 집계된 형태가 아닌 한 사람이 본 데이터를 직접 열람하지 않습니다.",
      ],
    },
    {
      heading: "방침의 변경",
      body: [
        "본 방침은 수시로 개정될 수 있습니다. 중대한 변경은 효력 발생 전에 서비스 내 공지 또는 그 밖의 합리적인 방법으로 통지됩니다. 위 “최종 수정일”이 현재 버전을 나타냅니다.",
      ],
    },
    {
      heading: "개인정보 보호책임자 및 문의",
      body: [
        `본 방침 또는 개인정보에 관한 문의·요청·민원은 개인정보의 관리에 관한 책임자에게 ${CONTACT} 로 연락하실 수 있습니다.`,
        "운영자는 이용자의 요청을 부당한 지체 없이, 관계 법령이 정하는 기간 내에 처리하기 위하여 합리적인 노력을 다합니다.",
      ],
    },
  ],
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  const d = locale === "ko" ? ko : en;
  return <LegalDoc title={d.title} updated={d.updated} sections={d.sections} />;
}
