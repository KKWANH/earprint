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
      heading: "Sub-processors",
      body: [
        "We do not sell or rent personal information. We use the following service providers to operate the Service, and only to the extent necessary:",
        "Cloudflare, Inc. (US) — application hosting + edge delivery. Transfer mechanism: EU-US Data Privacy Framework certification.",
        "Neon, Inc. (US) — managed PostgreSQL database. Transfer mechanism: EU-US Data Privacy Framework + Standard Contractual Clauses.",
        "Google LLC (US) — Google Sign-In + Gemini AI analysis + (with explicit opt-in) YouTube Data API. Transfer mechanism: EU-US Data Privacy Framework.",
        "Lemon Squeezy (US, a Stripe subsidiary) — Merchant of Record for payment processing. Transfer mechanism: EU-US Data Privacy Framework.",
        "Resend, Inc. (US) — transactional email (analysis-summary email; optional). Transfer mechanism: EU-US Data Privacy Framework + Standard Contractual Clauses.",
        "Deezer SA (France, EU) — track metadata + 30-second previews. No restricted transfer.",
        "Last.fm / Audioscrobbler Ltd (UK) — artist similarity + tag enrichment. UK adequacy decision applies.",
        "MetaBrainz Foundation / MusicBrainz (US) — release-year lookup. Anonymous queries (no user identifier sent).",
        "We may also disclose information where required by law, court order, or governmental authority, or where necessary to protect the rights, safety, or property of the Operator, our users, or the public.",
      ],
    },
    {
      heading: "Profiling and automated decision-making",
      body: [
        "Several Service features rely on automated profiling of your music taste: the Music Zodiac, the AI music-psychology profile, the Digging Score, the Recommendation engine, the Taste DNA reminiscence and novelty indices, and the Artist Map.",
        "These features process music-related data only — the song titles, artists, genres, and moods you have liked. They do not produce decisions that have legal or similarly significant effects on you under GDPR Article 22(1).",
        "The AI music-psychology profile requires your explicit consent (collected during onboarding and revocable from /account). All other profiling uses only the music data you provided and powers user-facing analytics; you may delete the underlying data at any time by deleting your account, which removes the profiling outputs.",
      ],
    },
    {
      heading: "International transfers",
      body: [
        "Most of our sub-processors are based in the United States. Personal data transferred from the EU/UK/Korea to the US relies on the EU-US Data Privacy Framework (DPF) and corresponding UK + Swiss extensions, which the European Commission deemed adequate in July 2023. Where DPF coverage does not apply, we additionally rely on the EU Standard Contractual Clauses (Module 2).",
        "We do not transfer personal data to providers in jurisdictions without an adequacy decision or equivalent safeguard. Notably, we have removed the previously-tested Moonshot (Kimi) AI provider for this reason: it is China-based and the Schrems II Transfer Impact Assessment cannot be satisfied for that destination at this time.",
      ],
    },
    {
      heading: "Data retention",
      body: [
        "We retain account, music, and activity data for as long as your account exists. When you delete your account via /account, every user-scoped row (synced tracks, AI analyses, ratings, profile, share IDs, payment state) is removed within 24 hours by a daily cleanup task.",
        "Automated retention sweeps run daily and delete: per-user usage counters older than 90 days, anonymous AI cost-tracking older than 90 days, and finished background jobs older than 30 days.",
        "Accounts with no sign-in activity for 3 consecutive years are automatically removed in their entirety. We recommend exporting your data first via /account → Download my data.",
        "Where paid features are used, records relating to payments, contracts, and subscription withdrawals are retained for the periods required by applicable law — for the Republic of Korea, the retention periods prescribed by the Act on the Consumer Protection in Electronic Commerce (records of contracts and payment for five years, records of consumer complaints or dispute resolution for three years).",
        "Technical and log data are retained for a limited period (typically 30 days) for security and operational purposes.",
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
        "We use only strictly-necessary cookies. No analytics cookies, no advertising cookies, no third-party tracking.",
        "Cookies set: `__Secure-authjs.session-token` (sign-in session; HttpOnly; expires when you sign out), `locale` (which language you picked; expires after 1 year), `yt_oauth_state` (CSRF token for the optional YouTube data import; expires in 10 minutes).",
        "Because every cookie is strictly necessary to operate the Service you requested, formal opt-in consent under the ePrivacy Directive is not required. A one-time informational banner is shown on first visit and can be dismissed.",
      ],
    },
    {
      heading: "Your rights and choices",
      body: [
        "Subject to applicable law, you have the right to: access your personal information (GDPR Art. 15); have inaccurate information corrected (Art. 16); have your information deleted (Art. 17); restrict processing (Art. 18); receive your data in a portable format (Art. 20); object to processing based on legitimate interests (Art. 21); and withdraw consent at any time without affecting prior processing.",
        "Self-service controls on /account: Download my data (machine-readable JSON export — fulfils Articles 15 + 20); Disconnect YouTube (revoke the optional API scope); AI profiling consent toggle (immediately stops new AI generations); Delete account (permanently removes every user-scoped row within 24 hours).",
        "You can also revoke Earprint's access to your Google account from your Google Account settings (Security → Third-party access). For requests we can't satisfy through the self-service controls, contact the address below; we respond within 30 days as required by GDPR Art. 12(3).",
        "You may lodge a complaint with your data-protection authority. In Belgium: Autorité de protection des données / Gegevensbeschermingsautoriteit (APD / GBA). In Korea: Personal Information Protection Commission (PIPC, 개인정보 보호위원회). Other EU member states have their own national DPA.",
      ],
    },
    {
      heading: "Children's privacy",
      body: [
        "Earprint is not directed to children. We require all users to confirm they are at least 16 years old during onboarding — this is the strictest GDPR Article 8 baseline. Some EU member states permit lower ages (Belgium 13, Spain 14, etc.); we apply 16 uniformly for safety.",
        "For the Republic of Korea, the PIPA threshold is 14; users between 14 and 16 may use the Service but parents who become aware of an under-14 account should contact us for immediate removal.",
        "If we become aware that we have collected information from a child below the applicable age without appropriate consent, we will delete it promptly.",
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
      heading: "수탁 처리자 (Sub-processors)",
      body: [
        "운영자는 개인정보를 판매하거나 임대하지 않습니다. 서비스 운영에 필요한 범위 내에서 다음 서비스 제공자만 사용합니다:",
        "Cloudflare, Inc. (미국) — 애플리케이션 호스팅 + 엣지 전송. 이전 메커니즘: EU-US Data Privacy Framework 인증.",
        "Neon, Inc. (미국) — 관리형 PostgreSQL. 이전 메커니즘: DPF + 표준계약조항 (SCC).",
        "Google LLC (미국) — Google Sign-In + Gemini AI 분석 + (명시적 옵트인 시) YouTube Data API. 이전 메커니즘: DPF.",
        "Lemon Squeezy (미국, Stripe 자회사) — 결제대행사 (Merchant of Record). 이전 메커니즘: DPF.",
        "Resend, Inc. (미국) — 트랜잭션 이메일 (분석 요약 메일, 선택). 이전 메커니즘: DPF + SCC.",
        "Deezer SA (프랑스, EU) — 곡 메타데이터 + 30초 미리듣기. 제한적 이전 해당 없음.",
        "Last.fm / Audioscrobbler Ltd (영국) — 아티스트 유사도 + 태그. 영국 적합성 결정 적용.",
        "MetaBrainz Foundation / MusicBrainz (미국) — 발매연도 조회. 익명 쿼리 (사용자 식별자 미전송).",
        "법령·법원의 명령·정부기관의 요구가 있는 경우, 또는 운영자·이용자·공중의 권리·안전·재산을 보호하기 위해 필요한 경우 정보를 제공할 수 있습니다.",
      ],
    },
    {
      heading: "프로파일링 및 자동화된 의사결정",
      body: [
        "다음 기능은 음악 취향에 대한 자동화된 프로파일링에 기반합니다: 음악 별자리, AI 음악 심리분석, 디깅 점수, 추천 엔진, 취향 DNA 의 reminiscence·novelty 지수, 아티스트 맵.",
        "이 기능들은 좋아요 곡의 제목·아티스트·장르·무드 데이터만 처리합니다. GDPR 제22조(1) 가 정의하는 '법적 또는 이에 준하는 중대한 영향' 을 미치는 결정을 생성하지 않습니다.",
        "AI 음악 심리분석은 명시적 동의가 필요합니다 (가입 시 1회 수집, /account 에서 언제든 철회 가능). 그 외 프로파일링은 이용자가 제공한 음악 데이터만으로 사용자 대상 기능을 제공합니다 — 계정 삭제 시 모든 프로파일링 출력도 함께 삭제됩니다.",
      ],
    },
    {
      heading: "국외 이전",
      body: [
        "수탁 처리자 대부분은 미국에 소재합니다. EU·영국·한국에서 미국으로의 개인정보 이전은 2023년 7월 EU 집행위원회가 적합성 결정을 내린 EU-US Data Privacy Framework (DPF) 와 영국·스위스 확장 메커니즘에 의존합니다. DPF 가 적용되지 않는 경우 EU 표준계약조항 (Module 2) 을 추가로 적용합니다.",
        "적합성 결정·동등 보호장치가 없는 국가의 제공자에게는 개인정보를 이전하지 않습니다. 특히 이전에 테스트했던 Moonshot (Kimi) AI 제공자는 이 사유로 제거되었습니다 — 중국 소재이며 Schrems II 판례에 따른 Transfer Impact Assessment 를 현재 통과시킬 방법이 없습니다.",
      ],
    },
    {
      heading: "개인정보의 보유 기간",
      body: [
        "운영자는 계정·음악·활동 데이터를 이용자의 계정이 존재하는 동안 보유합니다. /account 에서 계정을 삭제하면 모든 사용자 단위 행 (동기화 곡·AI 분석·평가·프로필·공유 ID·결제 상태) 이 일일 정리 task 를 통해 24시간 내에 삭제됩니다.",
        "자동 보존 정리는 매일 실행되며 다음을 삭제합니다: 90일 이상 된 사용자 사용량 카운터, 90일 이상 된 익명 AI 비용 추적, 30일 이상 된 완료/실패 백그라운드 작업.",
        "3년 연속 로그인 활동이 없는 계정은 전체가 자동 삭제됩니다. 사전에 /account → '내 데이터 다운로드' 로 데이터를 받아두는 것을 권장합니다.",
        "유료 기능 이용 시 결제·계약·청약철회 기록은 관계 법령이 정하는 기간 동안 보관됩니다. 대한민국의 경우 「전자상거래 등에서의 소비자보호에 관한 법률」(계약·결제 5년, 소비자 불만·분쟁처리 3년) 에 따릅니다.",
        "기술·로그 정보는 보안 및 운영 목적으로 제한된 기간 (통상 30일) 동안 보관됩니다.",
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
        "꼭 필요한 쿠키만 사용합니다. 분석 쿠키 없음, 광고 쿠키 없음, 제3자 추적 없음.",
        "설정되는 쿠키: `__Secure-authjs.session-token` (로그인 세션; HttpOnly; 로그아웃 시 만료), `locale` (선택한 언어; 1년 만료), `yt_oauth_state` (선택적 YouTube 데이터 가져오기 CSRF 토큰; 10분 만료).",
        "모든 쿠키가 이용자가 요청한 서비스 운영에 꼭 필요하므로 ePrivacy 지침상 명시적 옵트인 동의는 필요하지 않습니다. 첫 방문 시 안내 배너를 1회 표시하며 닫을 수 있습니다.",
      ],
    },
    {
      heading: "이용자의 권리 및 행사 방법",
      body: [
        "관계 법령에 따라 이용자는 다음 권리를 가집니다: 개인정보 열람 (GDPR 제15조), 부정확한 정보의 정정 (제16조), 정보 삭제 (제17조), 처리 제한 (제18조), 이동 가능한 형식으로 데이터 수령 (제20조), 정당한 이익 기반 처리에 대한 이의제기 (제21조), 그리고 언제든지 동의 철회 (이전 처리에는 영향 없음).",
        "/account 에서 셀프 컨트롤 가능: '내 데이터 다운로드' (기계 판독 가능한 JSON — 제15·20조 충족), 'YouTube 연결 해제' (선택적 API 권한 회수), 'AI 프로파일링' 토글 (즉시 신규 AI 생성 중단), '계정 삭제' (모든 사용자 단위 행 24시간 내 영구 삭제).",
        "Google 계정 설정 (보안 → 서드파티 액세스) 에서도 Earprint 접근 권한 회수 가능. 셀프 컨트롤로 해결되지 않는 요청은 아래 연락처로 — GDPR 제12조(3) 에 따라 30일 내 답변.",
        "감독기관 민원 제기 가능. 벨기에: APD/GBA. 한국: 개인정보 보호위원회 (PIPC). 기타 EU 회원국은 자국 DPA.",
      ],
    },
    {
      heading: "아동의 개인정보",
      body: [
        "Earprint 는 아동을 대상으로 하지 않습니다. 가입 시 모든 이용자에게 만 16세 이상 확인을 요구합니다 — GDPR 제8조의 가장 엄격한 기준입니다. 일부 EU 회원국은 더 낮은 연령을 허용하지만 (벨기에 13세, 스페인 14세 등) 안전을 위해 16세를 일괄 적용합니다.",
        "대한민국의 경우 PIPA 기준은 14세입니다. 14~16세 이용자는 서비스 이용 가능하지만, 14세 미만 계정을 인지한 부모는 즉시 삭제를 요청해 주세요.",
        "적법한 동의 없이 해당 연령 미만 아동의 정보가 수집된 사실을 인지한 경우 운영자는 이를 지체 없이 삭제합니다.",
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
