import type { Locale } from "../i18n";

const en = {
  pageTitle: "Setup guide",
  intro:
    "Five steps from a fresh Chrome to your full music portrait. The whole flow takes about 10 minutes — plus background time while Gemini analyses your library.",
  installCta: "Add to Chrome",
  installNote: "Free · No account needed to install",
  mobileNote:
    "📱 Sync requires desktop Chrome — mobile Chrome doesn't support extensions. Once your library is synced from a desktop, you can browse your analysis, profile, zodiac and share page from any device.",
  videoComing: "Video walkthrough coming soon.",
  faqTitle: "Frequently asked",
  steps: [
    {
      title: "Install the extension",
      body: "Open the Chrome Web Store listing and click Add to Chrome. The extension lives next to the address bar and only activates on music.youtube.com.",
    },
    {
      title: "Sign in with Google",
      body: "Earprint uses your Google email as your account ID. We never see your password — sign-in is handled by Google directly, and we only get an email + display name.",
    },
    {
      title: "Connect your library",
      body: "Open /connect. The extension picks up a short-lived sync token automatically — no copy-paste — and uses it to send your liked-song metadata to your own account.",
    },
    {
      title: "Sync from YouTube Music",
      body: "Open music.youtube.com/playlist?list=LM (your Liked Music). Click the Earprint extension icon → Sync. The first sync of a large library can take a couple of minutes.",
    },
    {
      title: "Analyse + generate your portrait",
      body: "Back on Earprint, hit Start analysis on /library — Gemini fills in genre, mood and audio characteristics for each track. When that's done, /profile turns it into a music-psychology portrait and your zodiac.",
    },
  ],
  faq: [
    {
      q: "Does Earprint store my YouTube password?",
      a: "No. Sign-in is Google's standard OAuth — we receive a one-time consent and an email address. We never see or store passwords.",
    },
    {
      q: "What data leaves my machine?",
      a: "Track titles, artists, albums, and YouTube Music video IDs from your liked songs — that's it. No play history, no watch history, no payment info. The extension only reads pages on music.youtube.com.",
    },
    {
      q: "Why an extension instead of a normal web login?",
      a: "YouTube Music has no public API for personal libraries. The extension reads the same page you see, on your own machine, with your own session — nothing flows through a third-party scraper.",
    },
    {
      q: "Can I delete my data?",
      a: "Yes. /library has a Danger zone → Delete account button that removes every row tied to your account: liked tracks, analysis, profile, share IDs, everything.",
    },
  ],
};

const ko: typeof en = {
  pageTitle: "설치 및 이용 가이드",
  intro:
    "Chrome 설치부터 AI 음악 심리분석까지 5단계로 진행됩니다. 직접 조작이 필요한 시간은 약 10분이며, 이후에는 Gemini 가 백그라운드에서 라이브러리를 분석합니다.",
  installCta: "Chrome 에 추가",
  installNote: "무료 · 별도 계정 가입 불필요",
  mobileNote:
    "📱 동기화는 데스크탑 Chrome 에서만 가능합니다. 모바일 Chrome 은 확장프로그램을 지원하지 않기 때문입니다. 데스크탑에서 한 번 동기화하시면 분석 결과·프로필·별자리·공유 페이지는 모바일을 포함한 모든 기기에서 열람하실 수 있습니다.",
  videoComing: "영상 튜토리얼은 준비 중입니다.",
  faqTitle: "자주 묻는 질문",
  steps: [
    {
      title: "확장 프로그램 설치",
      body: "Chrome 웹 스토어에서 'Chrome 에 추가' 를 클릭하시면 주소창 옆에 Earprint 아이콘이 표시됩니다. 확장은 music.youtube.com 에서만 동작하며 다른 사이트에는 영향을 주지 않습니다.",
    },
    {
      title: "Google 계정으로 로그인",
      body: "Google 이메일이 곧 Earprint 계정의 식별자가 됩니다. 로그인은 Google OAuth 를 통해 이루어지며, 이메일과 표시 이름만 전달받습니다. 비밀번호는 어떠한 경우에도 Earprint 가 확인하거나 저장하지 않습니다.",
    },
    {
      title: "확장 연결",
      body: "/connect 페이지에 접속하시면 확장이 단기 사용 토큰을 자동으로 인식하여 본인 계정과 페어링합니다. 별도의 코드 복사·붙여넣기 절차가 필요하지 않습니다.",
    },
    {
      title: "YouTube Music 동기화",
      body: "music.youtube.com/playlist?list=LM (좋아요 음악) 페이지에서 확장 아이콘을 클릭하시면 'Sync' 버튼이 표시됩니다. 라이브러리 규모에 따라 첫 동기화에 약 1~2분이 소요됩니다.",
    },
    {
      title: "분석 및 프로필 생성",
      body: "Earprint 로 돌아가 /library 의 '분석 시작' 을 누르시면 Gemini 가 곡별 장르·무드·오디오 특성을 채워 넣습니다. 완료되면 /profile 에서 AI 음악 심리분석 결과와 음악 별자리를 확인하실 수 있습니다.",
    },
  ],
  faq: [
    {
      q: "Earprint 가 YouTube 비밀번호를 저장하나요?",
      a: "저장하지 않습니다. 로그인은 Google OAuth 표준 절차로 진행되며, Earprint 는 동의 후 발급되는 이메일·표시 이름만 전달받습니다. 비밀번호는 어떠한 단계에서도 Earprint 시스템을 거치지 않습니다.",
    },
    {
      q: "내 기기에서 어떤 데이터가 전송되나요?",
      a: "좋아요 곡의 제목·아티스트·앨범·YouTube Music 비디오 ID 만 전송됩니다. 재생 기록·시청 기록·결제 정보는 수집하거나 다루지 않습니다. 확장은 music.youtube.com 에서만 동작하며, 다른 사이트의 페이지에는 접근하지 않습니다.",
    },
    {
      q: "왜 웹 로그인이 아닌 확장 프로그램 방식을 사용하나요?",
      a: "YouTube Music 은 개인 라이브러리 조회를 위한 공식 API 를 제공하지 않습니다. 따라서 사용자가 직접 보고 있는 페이지를 본인 기기·본인 세션에서 읽는 방식이 가장 안전합니다. 제3자 서버나 스크래퍼를 거치지 않습니다.",
    },
    {
      q: "데이터를 완전히 삭제할 수 있나요?",
      a: "가능합니다. /account 페이지의 '계정 삭제' 버튼으로 계정에 연결된 모든 데이터(좋아요 곡·분석·프로필·공유 ID 등) 가 영구 삭제됩니다. 삭제 작업은 24시간 이내에 모든 백그라운드 정리까지 완료됩니다.",
    },
    {
      q: "추가로 분석을 돌리려면 비용이 어떻게 되나요?",
      a: "신규 가입 시 무료 분석 크레딧 1회가 기본 제공됩니다. 이후에는 1회 분석권 $2 또는 Pro 월 구독 $5 로 무제한 이용이 가능합니다. 자세한 내용은 요금제 페이지를 참고하시기 바랍니다.",
    },
  ],
};

export function guideDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
