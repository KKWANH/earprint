import type { Locale } from "../i18n";

const en = {
  pageTitle: "Setup guide",
  intro:
    "Five steps from a fresh Chrome to your full music portrait. The whole flow takes about 10 minutes — plus background time while Gemini analyses your library.",
  installCta: "Add to Chrome",
  installNote: "Free · No account needed to install",
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
  pageTitle: "설치·사용 가이드",
  intro:
    "크롬 처음 켜는 시점부터 음악 심리분석까지 5단계. 본격 작업은 10분 정도, 그 외엔 Gemini 가 백그라운드에서 라이브러리를 분석하는 시간입니다.",
  installCta: "Chrome 에 추가",
  installNote: "무료 · 설치만 하면 됨",
  videoComing: "영상 튜토리얼은 준비 중.",
  faqTitle: "자주 묻는 것",
  steps: [
    {
      title: "확장 설치",
      body: "Chrome Web Store 페이지에서 'Chrome 에 추가' 클릭. 주소창 옆에 아이콘이 뜨고, music.youtube.com 에서만 활성화됩니다.",
    },
    {
      title: "Google 로그인",
      body: "구글 이메일이 계정 ID 가 됩니다. 비밀번호는 보지 않고, 구글 OAuth 로 이메일·표시이름만 받습니다.",
    },
    {
      title: "확장 연결",
      body: "/connect 페이지를 엽니다. 확장이 짧은 수명의 동기화 토큰을 자동으로 읽어가서, 좋아요 곡 메타데이터를 본인 계정으로 보냅니다. 복사·붙여넣기 없음.",
    },
    {
      title: "유튜브 뮤직에서 동기화",
      body: "music.youtube.com/playlist?list=LM (내 좋아요) 페이지에서 확장 아이콘 → Sync. 라이브러리가 크면 첫 동기화에 1–2분.",
    },
    {
      title: "분석·프로필 생성",
      body: "Earprint 로 돌아와 /library 에서 '분석 시작'. Gemini 가 곡별 장르·무드·오디오 특성을 채웁니다. 끝나면 /profile 에서 음악 심리분석과 별자리가 나옵니다.",
    },
  ],
  faq: [
    {
      q: "Earprint 가 유튜브 비밀번호를 저장합니까?",
      a: "아니요. 구글 OAuth 로그인입니다 — 동의 한 번과 이메일만 받고, 비밀번호는 보지도 저장하지도 않습니다.",
    },
    {
      q: "내 PC 에서 어떤 데이터가 빠져나갑니까?",
      a: "좋아요 곡의 제목·아티스트·앨범·유튜브 뮤직 비디오 ID 가 전부입니다. 재생 기록·시청 기록·결제 정보는 일절 다루지 않습니다. 확장은 music.youtube.com 에서만 동작합니다.",
    },
    {
      q: "왜 일반 웹 로그인이 아니라 확장입니까?",
      a: "유튜브 뮤직은 개인 라이브러리용 공식 API 가 없습니다. 확장은 사용자가 보는 페이지를 사용자 PC 에서 사용자 세션으로 읽습니다 — 제3자 스크래퍼를 거치지 않습니다.",
    },
    {
      q: "내 데이터를 지울 수 있나요?",
      a: "네. /library 하단 Danger zone 의 '계정 삭제' 버튼이 모든 데이터(좋아요 곡·분석·프로필·공유 ID)를 삭제합니다.",
    },
  ],
};

export function guideDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
