import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `${locale === "ko" ? "이용약관" : "Terms of Service"} — Earprint`,
  };
}

const CONTACT = "kwanho0096@gmail.com";

const en = {
  title: "Terms of Service",
  updated: "Last updated: May 27, 2026",
  sections: [
    {
      heading: "Introduction and acceptance",
      body: [
        "These Terms of Service (the “Terms”) constitute a legally binding agreement between you (the “User”, “you”) and the operator of Earprint (the “Operator”, “we”, “us”) governing your access to and use of the Earprint website, the Earprint browser extension, and all related features and services (collectively, the “Service”).",
        "By accessing or using the Service, by signing in, or by installing the browser extension, you acknowledge that you have read, understood, and agree to be bound by these Terms and by the Privacy Policy, which is incorporated herein by reference. If you do not agree, you must not access or use the Service.",
      ],
    },
    {
      heading: "Definitions",
      body: [
        "“Account” means the user account created when you sign in to the Service through Google.",
        "“Content” means any data, text, ratings, notes, or other materials that you submit to, or that are generated for you within, the Service.",
        "“Paid Plan” means any subscription, one-time purchase, or other feature of the Service offered for a fee, if and when such features are made available.",
        "“Extension” means the Earprint browser extension used to collect your YouTube Music liked songs.",
      ],
    },
    {
      heading: "Eligibility",
      body: [
        "You must be at least 16 years of age to use the Service. This single age gate applies uniformly to all users in every jurisdiction — it is the strictest GDPR Article 8 baseline and sits above the minimum digital-consent age of other applicable laws (including Korea's PIPA, which sets 14). By using the Service you represent and warrant that you meet this requirement and that you have the legal capacity to enter into these Terms.",
        "If you use the Service on behalf of an organization, you represent that you are authorized to bind that organization to these Terms.",
      ],
    },
    {
      heading: "Description of the Service",
      body: [
        "Earprint is a personal, educational tool that analyzes your YouTube Music liked songs and presents an interpretation of your music taste, including statistics, an artist map, an automatically generated psychology-style profile, and recommendations.",
        "The Service is currently provided free of charge. The Operator reserves the right to introduce Paid Plans in the future, as described in these Terms.",
      ],
    },
    {
      heading: "Accounts and registration",
      body: [
        "Access to most features requires an Account, created by authenticating with a Google account. You agree to provide accurate information and to keep your Account credentials secure. You are responsible for all activity that occurs under your Account.",
        "You may maintain only one Account for your own personal use. You must notify us promptly of any unauthorized use of your Account.",
      ],
    },
    {
      heading: "The Extension and YouTube Music data",
      body: [
        "The Extension is a user-initiated tool that runs inside your own browser tab. When you click sync, it reads the same list of liked songs that is already visible to you on your own YouTube Music \"Liked music\" page in your own logged-in session, and uploads only that list (title, artist, album, the order you liked them) to your Earprint Account. It does not interact with any other YouTube data, does not bypass any access control, and does not download audio, video, or other users' content.",
        "Earprint accesses only your own data, from your own session. The Service does not, and is not designed to, access data belonging to any other person. As with any third-party browser tool you choose to install, you remain responsible for ensuring that your usage is consistent with the terms of service of YouTube and Google.",
        "An optional, separate mechanism uses the official YouTube Data API (scope: youtube.readonly) for users who explicitly grant it. This is described in the Privacy Policy and on the /connect page; it can be disconnected at any time from /account.",
      ],
    },
    {
      heading: "Acceptable use",
      body: [
        "You agree not to: (a) use the Service for any unlawful purpose or in violation of any applicable law or regulation; (b) attempt to access data, accounts, or systems that do not belong to you; (c) interfere with, disrupt, overload, or circumvent any security or rate-limiting feature of the Service; (d) reverse engineer, decompile, scrape, or create derivative works from the Service except as permitted by law; (e) resell, sublicense, or commercially exploit the Service without our written consent; or (f) use any automated means to access the Service in a manner that places an unreasonable load on our infrastructure.",
        "We may investigate and take appropriate action, including suspension or termination of your Account, against any User who violates this Section.",
      ],
    },
    {
      heading: "User Content",
      body: [
        "You retain all rights you may have in your Content. By submitting Content to the Service, you grant the Operator a worldwide, non-exclusive, royalty-free license to host, store, process, reproduce, and display that Content solely for the purpose of operating, providing, and improving the Service.",
        "You represent that you have all rights necessary to submit your Content and that it does not infringe the rights of any third party.",
      ],
    },
    {
      heading: "Intellectual property",
      body: [
        "The Service, including its software, design, text, graphics, logos, and the “Earprint” name and branding, is owned by the Operator or its licensors and is protected by intellectual property laws. Except for the limited right to use the Service in accordance with these Terms, no rights are granted to you.",
        "Music metadata, album artwork, and preview audio are provided by third parties and remain the property of their respective owners.",
      ],
    },
    {
      heading: "Paid Plans and fees",
      body: [
        "If and when the Operator offers Paid Plans, the features, scope, and price of each Paid Plan will be clearly displayed before you complete a purchase. By purchasing a Paid Plan you agree to pay all applicable fees and taxes.",
        "All fees are stated inclusive or exclusive of value-added tax as indicated at the point of sale. You are responsible for any taxes not collected by us.",
        "The Operator may change the fees for any Paid Plan. For recurring subscriptions, fee changes will take effect only at the start of the next billing cycle and will be notified to you in advance; your continued use after the change constitutes acceptance.",
      ],
    },
    {
      heading: "Billing, renewal and payment processing",
      body: [
        "Payments for Paid Plans, if offered, will be processed by one or more third-party payment processors. The Operator does not collect or store your full card number, card security code, or bank credentials; these are handled directly by the payment processor under its own terms and privacy policy.",
        "Subscription Paid Plans renew automatically at the end of each billing cycle at the then-current price, unless cancelled before the renewal date. By subscribing, you authorize us and our payment processor to charge the applicable fee to your selected payment method on each renewal.",
        "If a payment fails or is reversed, we may suspend or downgrade the corresponding Paid Plan features until payment is resolved.",
      ],
    },
    {
      heading: "Cancellation, withdrawal and refunds",
      body: [
        "You may cancel a subscription at any time; cancellation stops future renewals and takes effect at the end of the current billing cycle. You will retain access to Paid Plan features until that time.",
        "Where required by applicable consumer-protection law — including, for Users in the Republic of Korea, the Act on the Consumer Protection in Electronic Commerce — you may have the right to withdraw from a purchase within seven (7) days of the transaction. This right may be limited or excluded for digital content or services that have already been provided, used, or consumed, to the extent permitted by law, and where such limitation was disclosed before purchase.",
        "Approved refunds will be made using the same method of payment used for the original transaction, within the period required by applicable law. Nothing in these Terms limits any non-waivable refund or withdrawal right you have under mandatory consumer-protection law.",
      ],
    },
    {
      heading: "Third-party services and no affiliation",
      body: [
        "The Service relies on third-party services, including Google (authentication), Deezer, Last.fm and MusicBrainz (music metadata), Google Gemini (AI analysis), Resend (email delivery), Neon (database hosting) and Cloudflare (application hosting). Your use of those services through Earprint may also be subject to their respective terms.",
        "Earprint is an independent project and is not affiliated with, endorsed by, or sponsored by Google, YouTube, Deezer, Last.fm, MusicBrainz, or any other third party named in the Service.",
      ],
    },
    {
      heading: "Disclaimers",
      body: [
        "The Service is provided “as is” and “as available”, without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, accuracy, or non-infringement, to the maximum extent permitted by law.",
        "Analysis results, scores, personas, and recommendations are automatically generated estimates produced from incomplete data, are provided for entertainment and educational purposes only, and must not be relied upon as professional, psychological, or factual advice.",
      ],
    },
    {
      heading: "Limitation of liability",
      body: [
        "To the maximum extent permitted by applicable law, the Operator shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising out of or relating to your use of, or inability to use, the Service.",
        "To the maximum extent permitted by law, the Operator's total aggregate liability arising out of or relating to the Service shall not exceed the greater of the amount you paid to the Operator in the twelve (12) months preceding the event giving rise to the liability, or KRW 50,000.",
        "Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable law, including liability for wilful misconduct or gross negligence.",
      ],
    },
    {
      heading: "Indemnification",
      body: [
        "You agree to indemnify and hold harmless the Operator from and against any claims, damages, losses, and reasonable expenses arising out of your breach of these Terms, your misuse of the Service, or your violation of any law or of the rights of any third party.",
      ],
    },
    {
      heading: "Suspension and termination",
      body: [
        "You may stop using the Service and delete your Account at any time from within the Service. Deletion is permanent and erases your associated data, subject to records we are required to retain by law.",
        "We may suspend or terminate your access to the Service, in whole or in part, with or without notice, if you breach these Terms, if required by law, or if necessary to protect the Service or other Users. Where reasonably practicable, we will provide advance notice.",
        "Sections that by their nature should survive termination — including intellectual property, disclaimers, limitation of liability, indemnification, and governing law — shall survive.",
      ],
    },
    {
      heading: "Changes to the Service and these Terms",
      body: [
        "We may modify, suspend, or discontinue the Service, in whole or in part, at any time. We may also amend these Terms. Material changes will be notified through the Service or by other reasonable means before they take effect.",
        "Your continued use of the Service after changes take effect constitutes acceptance of the amended Terms. If you do not agree to the changes, you must stop using the Service.",
      ],
    },
    {
      heading: "Governing law and dispute resolution",
      body: [
        "These Terms are governed by the laws of the Republic of Korea, without regard to its conflict-of-laws rules. Any dispute arising out of or relating to these Terms or the Service shall be submitted to the courts having jurisdiction under the Civil Procedure Act of the Republic of Korea.",
        "If you are a consumer, this Section does not deprive you of the protection of any mandatory provisions of the law of your country of residence, and any mandatory dispute-resolution forum available to you under such law remains available.",
      ],
    },
    {
      heading: "Miscellaneous",
      body: [
        "If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full force and effect. Our failure to enforce any provision is not a waiver of that provision.",
        "You may not assign or transfer these Terms without our prior written consent. We may assign these Terms in connection with a merger, acquisition, or transfer of the Service. These Terms, together with the Privacy Policy, constitute the entire agreement between you and the Operator regarding the Service.",
      ],
    },
    {
      heading: "Contact and business information",
      body: [
        `Questions about these Terms may be directed to ${CONTACT}.`,
        "Earprint is currently operated as a personal, non-commercial project and offers no Paid Plans. Before any Paid Plan is made available, the Operator will complete the business and mail-order-seller registrations required by applicable law and will publish the corresponding business information (including operator name, registration numbers, and address) in these Terms.",
      ],
    },
  ] as LegalSection[],
};

const ko: typeof en = {
  title: "이용약관",
  updated: "최종 수정일: 2026년 5월 27일",
  sections: [
    {
      heading: "총칙 및 동의",
      body: [
        "본 이용약관(이하 “약관”)은 이용자(이하 “이용자” 또는 “귀하”)와 Earprint 운영자(이하 “운영자”) 사이에서, Earprint 웹사이트·브라우저 확장프로그램 및 이와 관련된 일체의 기능과 서비스(이하 통칭 “서비스”)의 이용에 관한 권리·의무 및 책임사항을 규정함을 목적으로 합니다.",
        "이용자가 서비스에 접속하거나 이를 이용하는 경우, 로그인하는 경우, 또는 확장프로그램을 설치하는 경우, 이용자는 본 약관 및 본 약관에 편입되는 개인정보처리방침을 읽고 이해하였으며 이에 동의한 것으로 봅니다. 동의하지 않는 경우 서비스를 이용할 수 없습니다.",
      ],
    },
    {
      heading: "정의",
      body: [
        "“계정”이란 이용자가 Google 을 통해 인증하여 생성하는 서비스 이용 계정을 말합니다.",
        "“콘텐츠”란 이용자가 서비스에 제출하거나 서비스 내에서 이용자를 위하여 생성되는 데이터·텍스트·평가·메모 등 일체의 자료를 말합니다.",
        "“유료 플랜”이란 향후 유료로 제공될 수 있는 구독·단건 결제 등 일체의 유료 기능을 말합니다.",
        "“확장프로그램”이란 이용자의 YouTube Music 좋아요 곡을 수집하기 위해 사용되는 Earprint 브라우저 확장프로그램을 말합니다.",
      ],
    },
    {
      heading: "이용 자격",
      body: [
        "이용자는 만 16세 이상이어야 합니다. 단일한 16세 기준이 모든 국가의 이용자에게 일괄 적용됩니다 — GDPR 제8조의 가장 엄격한 기준이자 대한민국 PIPA(14세) 등 그 밖의 관계 법령상 디지털 동의 최소연령보다 높은 수준입니다. 서비스를 이용함으로써 이용자는 위 요건을 충족하고 본 약관을 체결할 법적 능력이 있음을 진술·보증합니다.",
        "이용자가 단체를 대표하여 서비스를 이용하는 경우, 해당 단체를 본 약관에 구속시킬 권한이 있음을 진술·보증합니다.",
      ],
    },
    {
      heading: "서비스의 내용",
      body: [
        "Earprint 는 이용자의 YouTube Music 좋아요 곡을 분석하여, 통계·아티스트 맵·자동 생성 심리 프로파일·추천 등 음악 취향에 대한 해석을 제공하는 개인용·교육용 도구입니다.",
        "서비스는 현재 무료로 제공됩니다. 운영자는 본 약관에 따라 향후 유료 플랜을 도입할 권리를 보유합니다.",
      ],
    },
    {
      heading: "계정 및 가입",
      body: [
        "대부분의 기능 이용에는 Google 계정 인증을 통해 생성되는 계정이 필요합니다. 이용자는 정확한 정보를 제공하고 계정 인증수단을 안전하게 관리할 의무가 있으며, 자신의 계정에서 발생하는 모든 활동에 대하여 책임을 집니다.",
        "이용자는 본인의 개인적 이용을 위하여 하나의 계정만을 보유할 수 있으며, 계정의 무단 사용을 인지한 경우 즉시 운영자에게 통지하여야 합니다.",
      ],
    },
    {
      heading: "확장프로그램 및 YouTube Music 데이터",
      body: [
        "확장프로그램은 이용자의 브라우저 탭 내부에서 실행되는 이용자 주도(user-initiated) 도구입니다. 이용자가 동기화를 클릭하면, 이용자 본인이 로그인한 YouTube Music \"좋아요 한 음악\" 페이지에 이미 표시되어 있는 좋아요 곡 목록과 동일한 목록을 읽어, 해당 목록만(곡명·아티스트·앨범·좋아요 순서) Earprint 계정에 업로드합니다. 그 밖의 YouTube 데이터와 상호작용하지 않고, 어떤 접근 통제도 우회하지 않으며, 오디오·영상·타 이용자의 콘텐츠를 다운로드하지 않습니다.",
        "Earprint 는 이용자 본인의 세션에서 본인의 데이터에만 접근하며, 타인의 데이터에 접근하지 않고 그러한 목적으로 설계되지도 않았습니다. 어떤 제3자 브라우저 도구든 마찬가지로, 이용자의 사용 행위가 YouTube 및 Google 의 이용약관에 부합하도록 할 책임은 이용자 본인에게 있습니다.",
        "선택적이고 별도의 메커니즘으로, 명시적으로 권한을 부여한 이용자에 한해 공식 YouTube Data API (범위: youtube.readonly) 가 사용됩니다. 이는 개인정보처리방침과 /connect 페이지에 설명되어 있으며, /account 에서 언제든 연결을 해제할 수 있습니다.",
      ],
    },
    {
      heading: "금지행위",
      body: [
        "이용자는 다음 행위를 하여서는 안 됩니다. (a) 위법한 목적 또는 관계 법령에 위반하는 서비스 이용, (b) 본인에게 속하지 않은 데이터·계정·시스템에 대한 접근 시도, (c) 서비스의 보안 또는 이용량 제한 기능에 대한 방해·교란·우회, (d) 법이 허용하는 범위를 넘는 역설계·디컴파일·스크래핑 또는 2차적 저작물 작성, (e) 운영자의 서면 동의 없는 재판매·재라이선스·상업적 이용, (f) 운영자 인프라에 부당한 부하를 주는 방식의 자동화 수단 이용.",
        "운영자는 본 조를 위반한 이용자에 대하여 조사 후 계정의 정지 또는 해지를 포함한 적절한 조치를 취할 수 있습니다.",
      ],
    },
    {
      heading: "이용자 콘텐츠",
      body: [
        "이용자는 자신의 콘텐츠에 대한 권리를 보유합니다. 이용자는 콘텐츠를 서비스에 제출함으로써, 운영자에게 서비스의 운영·제공·개선의 목적에 한하여 해당 콘텐츠를 호스팅·저장·처리·복제·표시할 수 있는 전 세계적·비독점적·무상의 라이선스를 부여합니다.",
        "이용자는 자신의 콘텐츠를 제출할 정당한 권리를 보유하며 해당 콘텐츠가 제3자의 권리를 침해하지 않음을 진술·보증합니다.",
      ],
    },
    {
      heading: "지식재산권",
      body: [
        "서비스의 소프트웨어·디자인·텍스트·그래픽·로고 및 “Earprint” 명칭과 브랜드를 포함한 일체의 구성요소에 대한 지식재산권은 운영자 또는 그 라이선서에게 귀속되며 관계 법령에 의해 보호됩니다. 본 약관에 따른 제한적 이용권을 제외하고 이용자에게 어떠한 권리도 부여되지 않습니다.",
        "음악 메타데이터·앨범 아트·미리듣기 음원은 제3자가 제공하며 각 권리자에게 귀속됩니다.",
      ],
    },
    {
      heading: "유료 플랜 및 요금",
      body: [
        "운영자가 유료 플랜을 제공하는 경우, 각 유료 플랜의 기능·범위·가격은 결제 완료 전에 명확히 표시됩니다. 이용자는 유료 플랜을 구매함으로써 해당 요금 및 제세공과금을 지급하는 데 동의합니다.",
        "모든 요금은 판매 시점에 표시된 바에 따라 부가가치세를 포함하거나 별도로 합니다. 운영자가 징수하지 않는 조세는 이용자가 부담합니다.",
        "운영자는 유료 플랜의 요금을 변경할 수 있습니다. 정기 구독의 경우 요금 변경은 다음 결제주기 시작 시에만 적용되며 사전에 이용자에게 통지되고, 변경 후 계속 이용하는 것은 변경에 대한 동의로 봅니다.",
      ],
    },
    {
      heading: "결제, 갱신 및 결제대행",
      body: [
        "유료 플랜의 결제는 하나 이상의 외부 결제대행사(PG)를 통해 처리됩니다. 운영자는 이용자의 카드 전체 번호·카드 보안코드·계좌 인증정보를 수집·저장하지 않으며, 이는 결제대행사가 자신의 약관 및 개인정보처리방침에 따라 직접 처리합니다.",
        "구독형 유료 플랜은 갱신일 전에 해지하지 않는 한 각 결제주기 종료 시 그 시점의 가격으로 자동 갱신됩니다. 이용자는 구독함으로써 매 갱신 시 운영자 및 결제대행사가 선택된 결제수단으로 해당 요금을 청구하는 것을 승인합니다.",
        "결제가 실패하거나 취소된 경우, 운영자는 결제가 정상화될 때까지 해당 유료 기능을 정지하거나 하향 조정할 수 있습니다.",
      ],
    },
    {
      heading: "구독 해지, 청약철회 및 환불",
      body: [
        "이용자는 언제든지 구독을 해지할 수 있으며, 해지 시 향후 갱신이 중단되고 현재 결제주기 종료 시점에 효력이 발생합니다. 그 시점까지는 유료 기능을 계속 이용할 수 있습니다.",
        "대한민국 이용자의 경우 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 소비자보호법령에서 정하는 바에 따라, 거래일로부터 7일 이내에 청약을 철회할 권리를 가질 수 있습니다. 다만 이미 제공·이용·소비된 디지털 콘텐츠 또는 용역에 대하여는, 구매 전에 그러한 제한이 고지된 경우 법이 허용하는 범위에서 위 권리가 제한되거나 배제될 수 있습니다.",
        "승인된 환불은 관계 법령이 정하는 기간 내에 원거래에 사용된 동일한 결제수단으로 이루어집니다. 본 약관의 어떠한 내용도 강행적 소비자보호법령에 따라 이용자가 가지는 환불·청약철회 권리를 제한하지 않습니다.",
      ],
    },
    {
      heading: "제3자 서비스 및 비제휴",
      body: [
        "서비스는 Google(인증), Deezer·Last.fm·MusicBrainz(음악 메타데이터), Google Gemini(AI 분석), Resend(이메일 발송), Neon(데이터베이스 호스팅), Cloudflare(애플리케이션 호스팅) 등 제3자 서비스에 의존합니다. Earprint 를 통한 해당 서비스 이용에는 각 서비스의 약관이 함께 적용될 수 있습니다.",
        "Earprint 는 독립적인 프로젝트이며 Google·YouTube·Deezer·Last.fm·MusicBrainz 및 서비스 내에 언급된 그 밖의 제3자와 제휴·보증·후원 관계가 없습니다.",
      ],
    },
    {
      heading: "면책 고지",
      body: [
        "서비스는 법이 허용하는 최대 범위에서 명시적·묵시적·법정의 어떠한 보증도 없이 “있는 그대로” 및 “이용 가능한 상태로” 제공되며, 여기에는 상품성·특정 목적 적합성·정확성·비침해에 관한 묵시적 보증이 포함됩니다.",
        "분석 결과·점수·페르소나·추천은 불완전한 데이터로부터 자동 생성된 추정치로서 오락 및 교육 목적으로만 제공되며, 전문적·심리학적·사실적 조언으로 신뢰되어서는 안 됩니다.",
      ],
    },
    {
      heading: "책임의 제한",
      body: [
        "관계 법령이 허용하는 최대 범위에서, 운영자는 서비스의 이용 또는 이용 불가로 인하여 발생한 간접적·부수적·특별·결과적·징벌적 손해, 또는 데이터·이익·영업권의 상실에 대하여 책임을 지지 않습니다.",
        "관계 법령이 허용하는 최대 범위에서, 서비스와 관련한 운영자의 누적 총 책임은, 책임 발생 사유 이전 12개월간 이용자가 운영자에게 지급한 금액과 50,000원 중 큰 금액을 초과하지 않습니다.",
        "본 약관의 어떠한 내용도 고의 또는 중대한 과실에 대한 책임 등 관계 법령상 배제·제한할 수 없는 책임을 배제하거나 제한하지 않습니다.",
      ],
    },
    {
      heading: "면책 보상",
      body: [
        "이용자는 본 약관 위반, 서비스의 오용, 또는 법령이나 제3자 권리의 침해로 인하여 발생한 청구·손해·손실 및 합리적인 비용으로부터 운영자를 면책하고 보상하는 데 동의합니다.",
      ],
    },
    {
      heading: "이용 정지 및 해지",
      body: [
        "이용자는 언제든지 서비스 이용을 중단하고 서비스 내에서 계정을 삭제할 수 있습니다. 삭제는 영구적이며 관련 데이터를 삭제합니다. 다만 법령상 보존이 요구되는 기록은 그러하지 아니합니다.",
        "운영자는 이용자가 본 약관을 위반한 경우, 법령상 요구되는 경우, 또는 서비스나 다른 이용자를 보호하기 위하여 필요한 경우, 사전 통지 여부와 무관하게 서비스 접근의 전부 또는 일부를 정지하거나 해지할 수 있습니다. 합리적으로 가능한 경우 사전에 통지합니다.",
        "성질상 해지 후에도 존속하여야 하는 조항 — 지식재산권, 면책 고지, 책임의 제한, 면책 보상, 준거법 등 — 은 해지 후에도 효력을 유지합니다.",
      ],
    },
    {
      heading: "서비스 및 약관의 변경",
      body: [
        "운영자는 언제든지 서비스의 전부 또는 일부를 변경·중단·종료할 수 있으며, 본 약관을 개정할 수 있습니다. 중대한 변경은 효력 발생 전에 서비스 내 공지 또는 그 밖의 합리적인 방법으로 통지됩니다.",
        "변경 효력 발생 후 이용자가 서비스를 계속 이용하는 것은 개정된 약관에 대한 동의로 봅니다. 변경에 동의하지 않는 경우 이용자는 서비스 이용을 중단하여야 합니다.",
      ],
    },
    {
      heading: "준거법 및 분쟁해결",
      body: [
        "본 약관은 대한민국 법률에 따르며, 그 국제사법 원칙은 적용하지 않습니다. 본 약관 또는 서비스와 관련하여 발생한 분쟁은 대한민국 민사소송법에 따라 관할권을 가지는 법원에 제기합니다.",
        "이용자가 소비자인 경우, 본 조는 거주 국가 법률의 강행규정에 따른 보호를 박탈하지 아니하며, 그러한 법률에 따라 이용자에게 인정되는 강행적 분쟁해결 관할은 그대로 유지됩니다.",
      ],
    },
    {
      heading: "기타",
      body: [
        "본 약관의 일부 조항이 집행 불가능하다고 판단되는 경우에도 나머지 조항은 완전한 효력을 유지합니다. 운영자가 어떤 조항을 집행하지 않더라도 이는 해당 조항의 포기로 보지 않습니다.",
        "이용자는 운영자의 사전 서면 동의 없이 본 약관을 양도하거나 이전할 수 없습니다. 운영자는 합병·인수 또는 서비스 이전과 관련하여 본 약관을 양도할 수 있습니다. 본 약관은 개인정보처리방침과 함께 서비스에 관한 이용자와 운영자 간의 완전한 합의를 구성합니다.",
      ],
    },
    {
      heading: "문의 및 사업자 정보",
      body: [
        `본 약관에 관한 문의는 ${CONTACT} 로 하실 수 있습니다.`,
        "Earprint 는 현재 개인의 비영리 프로젝트로 운영되며 유료 플랜을 제공하지 않습니다. 유료 플랜을 제공하기 전에 운영자는 관계 법령상 요구되는 사업자등록 및 통신판매업 신고를 완료하고, 그에 따른 사업자 정보(상호·등록번호·주소 등)를 본 약관에 게재합니다.",
      ],
    },
  ],
};

export default async function TermsPage() {
  const locale = await getLocale();
  const d = locale === "ko" ? ko : en;
  return <LegalDoc title={d.title} updated={d.updated} sections={d.sections} />;
}
