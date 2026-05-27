import type { Locale } from "../i18n";

const en = {
  pageTitle: "Setup guide",
  intro:
    "Five steps from a fresh Chrome to your full music portrait. The whole flow takes about 10 minutes — plus background time while Gemini analyses your library.",
  installCta: "Add to Chrome",
  installNote: "Free · No account needed to install",
  mobileNote:
    "📱 Sync requires desktop Chrome — mobile Chrome doesn't support extensions. Once your library is synced from a desktop, you can browse your analysis, profile, zodiac and share page from any device.",
  whyExtensionTitle: "Why does Earprint need a browser extension?",
  whyExtensionBody:
    "YouTube Music has no public \"my liked songs\" API the way Spotify does. The only way to read your own liked-music list is to be logged in to music.youtube.com and read the page YouTube already shows you. That's what the extension does on your tab, on your click — it reads the same list you can see, nothing else. We send title / artist / album / videoId to Earprint; we don't read your watch history, your play history, your search history, or any other YouTube data. Your YouTube and Google passwords never reach Earprint.",
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
      a: "Yes. /account has a Danger zone → Delete account button that removes every row tied to your account: liked tracks, analysis, profile, share IDs, everything. Shared track metadata stays — it's not personal data and other users rely on it.",
    },
    {
      q: "The sync seems stuck — what do I do?",
      a: "If the popup hangs on \"Collecting…\" for more than 30 seconds, click Reset in the popup footer and try again. Big libraries (1,500+ tracks) sometimes need 2–3 sync attempts because YouTube's continuation pagination quietly stops paginating around the 1,400-row mark on some sessions.",
    },
    {
      q: "Analysis is stuck at 98% — is it broken?",
      a: "Almost always: Gemini hit a transient error on the last batch and the worker silently retries. Refresh /library after a minute. If the count hasn't moved in 5+ minutes, click the Reset link in /account and start the analysis again — your already-analysed tracks are kept.",
    },
    {
      q: "Why are \"BTS\" and \"방탄소년단\" counted as the same artist sometimes but not always?",
      a: "We merge them via a hand-curated alias table plus Deezer's artist ID. The alias table covers the top ~20 K-pop pairs out of the box; for less-mainstream artists, the dedupe happens after Deezer enrichment lands a shared artist ID. If you spot a mis-merge, the /account page has a contact link.",
    },
    {
      q: "How are the zodiac results computed?",
      a: "Your top genres + moods are matched against each of the 12 zodiac archetype keyword lists, using the longest matching keyword to avoid double-counting. The winner is the sign with the highest weighted-match score. The sub-flavor (e.g. \"Virgo · Jazz Maven\") is a second pass within the winning sign.",
    },
    {
      q: "Why does the analysis take so long?",
      a: "Phase 1 (Deezer enrichment) does ~30 tracks per minute. Phase 2 (Gemini) is faster — 80 tracks per call, ~30 seconds. A 1,500-track library typically finishes in 5–10 minutes once you click Start. Close the tab if you want — the worker keeps going in the background and emails you when it's done.",
    },
    {
      q: "What's the World Cup mode?",
      a: "A bracket tournament between your tracks — pick the winner of each pair until one champion remains. Four sources: your library, fresh recommendations, a 50/50 mix, or a genre-vs-genre bracket. Sizes go from 8 up to 256. The champion is shown locally; ratings don't write back to your library (use /recommend for that).",
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
  whyExtensionTitle: "Earprint 는 왜 브라우저 확장이 필요한가요?",
  whyExtensionBody:
    "YouTube Music 은 Spotify 처럼 \"내 좋아요 곡\" 을 읽을 수 있는 공개 API 가 없습니다. 본인의 좋아요 목록을 읽는 유일한 방법은 music.youtube.com 에 본인이 로그인한 상태에서 YouTube 가 본인에게 이미 보여주는 페이지를 그대로 읽는 것입니다. 확장은 본인의 탭에서 본인의 클릭으로 그 일만 합니다 — 화면에 보이는 그 목록만 읽고 그 외에는 아무것도 읽지 않습니다. Earprint 로는 곡명 / 아티스트 / 앨범 / videoId 만 전송되고, 시청 기록·재생 기록·검색 기록 같은 YouTube 데이터는 읽지 않습니다. YouTube·Google 비밀번호도 Earprint 에 절대 도달하지 않습니다.",
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
    {
      q: "Sync 가 멈춘 것 같습니다.",
      a: "Sync 진행 표시가 30초 이상 멈춰 있으면 팝업 하단의 'Reset' 을 누르시고 다시 시도해 주세요. 1,500곡 이상의 큰 라이브러리는 YouTube 의 페이지네이션이 약 1,400행 부근에서 조용히 중단되는 경우가 있어 2~3회 시도가 필요할 수 있습니다.",
    },
    {
      q: "분석이 98% 에서 멈췄습니다 — 오류인가요?",
      a: "대부분의 경우 Gemini 가 일시적 오류를 만났고 워커가 자동 재시도 중입니다. /library 를 1분 후 새로고침해 주세요. 5분 이상 변동이 없다면 /account → Reset 후 분석을 재시작해 주세요. 이미 분석된 곡은 유지됩니다.",
    },
    {
      q: "'BTS' 와 '방탄소년단' 이 따로 잡힐 때가 있습니다.",
      a: "수동 alias 테이블 + Deezer artist ID 두 가지로 병합합니다. alias 테이블에는 상위 K-pop 약 20쌍이 기본 등록되어 있고, 그 외 아티스트는 Deezer enrichment 후 공통 artist ID 로 자동 병합됩니다. 잘못 병합된 사례를 발견하시면 /account 페이지의 문의 링크로 알려주세요.",
    },
    {
      q: "별자리 결과는 어떻게 산출되나요?",
      a: "상위 장르·무드를 12개 별자리 각각의 키워드 리스트와 매칭한 뒤, 가장 긴 키워드 매칭을 우선시하여 중복 카운트를 방지합니다. 가중치 합산 점수가 가장 높은 별자리가 결과로 선정되며, 그 안에서 다시 sub-flavor (예: '처녀자리 · 재즈 마니아') 가 한 단계 더 산출됩니다.",
    },
    {
      q: "분석에 시간이 얼마나 걸리나요?",
      a: "Phase 1 (Deezer 메타데이터 보강) 은 분당 약 30곡, Phase 2 (Gemini AI 분석) 는 1회 호출당 80곡으로 30초 가량 소요됩니다. 1,500곡 기준 약 5~10분이면 완료됩니다. 탭을 닫으셔도 백그라운드에서 계속 진행되며, 완료 시 이메일로 안내됩니다.",
    },
    {
      q: "월드컵 모드는 무엇인가요?",
      a: "내 곡들을 두 곡씩 붙여 더 듣고 싶은 쪽을 고르는 토너먼트입니다. 4가지 카테고리(내 좋아요 / 새 추천 / 섞기 / 최애 장르) 와 8강~256강 사이즈를 선택할 수 있습니다. 우승곡은 화면에만 표시되며, 라이브러리 평가에는 반영되지 않습니다 (그 용도로는 /recommend 페이지를 사용해 주세요).",
    },
  ],
};

export function guideDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
