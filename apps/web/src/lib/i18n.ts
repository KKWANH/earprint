/**
 * Lightweight i18n — dictionary objects usable from both server and client
 * components. The server-only locale reader lives in `i18n-server.ts` so this
 * module stays importable from client components.
 */
export type Locale = "en" | "ko";
export const LOCALES: Locale[] = ["en", "ko"];

const en = {
  nav: {
    library: "Library",
    dna: "Taste DNA",
    map: "Artist Map",
    recommend: "Recommend",
    profile: "Psychology",
    connect: "Connect",
  },
  landing: {
    tagline: "Understand why you love the music you love.",
    intro:
      "Earprint collects your YouTube Music liked songs and turns them into a research-grounded portrait of your taste — not another year-end chart.",
    ctaIn: "Open your dashboard →",
    ctaOut: "Sign in with Google",
    signedInAs: "Signed in as",
    scienceTitle: "A mirror of your listening mind",
    scienceBody:
      "Most music apps tell you what you played. This one explains why. It draws on three established bodies of research: the brain's reward for prediction-meets-surprise, the adolescent reminiscence bump that cements the music of your teens, and how openness shapes a lifelong taste trajectory.",
    featuresTitle: "What you get",
    f1Title: "Library dashboard",
    f1Body: "Top artists, genres, moods, audio-feel and album depth at a glance.",
    f2Title: "Taste DNA",
    f2Body:
      "Your reminiscence-bump imprint core and a familiarity↔novelty index, grounded in music psychology.",
    f3Title: "Artist map",
    f3Body:
      "An interactive map of your artists — with unheard, related artists you can add in one tap.",
    f4Title: "Recommendations",
    f4Body: "Five discovery modes, swipe to rate; your ratings reshape what comes next.",
    howTitle: "How it works",
    s1: "Install the Chrome extension",
    s2: "Sync your liked songs from YouTube Music",
    s3: "Explore your Taste DNA, artist map and recommendations",
    galleryTitle: "Your music, as a persona",
    gallerySubtitle:
      "Earprint turns your liked songs into a shareable music character — here are a few examples.",
    footer: "A personal, research-grounded music-taste tool.",
  },
};

export type Dict = typeof en;

const ko: Dict = {
  nav: {
    library: "라이브러리",
    dna: "취향 DNA",
    map: "아티스트 맵",
    recommend: "추천",
    profile: "심리분석",
    connect: "확장 연결",
  },
  landing: {
    tagline: "내가 좋아하는 음악, 왜 좋아하는지 알아봐요.",
    intro:
      "Earprint 는 유튜브 뮤직 좋아요 곡을 모아, 연말 결산 차트가 아니라 음악 심리학에 기반한 진짜 취향 분석으로 바꿔 줘요.",
    ctaIn: "내 대시보드 열기 →",
    ctaOut: "Google 로 로그인",
    signedInAs: "로그인:",
    scienceTitle: "내가 듣는 음악을 비추는 거울",
    scienceBody:
      "대부분의 음악 앱은 '무엇을 들었는지'만 보여줘요. Earprint 는 '왜 좋아하는지'를 설명합니다 — 예측이 맞을 때 뇌가 주는 보상, 10대의 음악을 평생 따라다니게 만드는 회상 효과, 개방성이 빚어낸 평생의 취향 궤적. 이 세 가지 연구를 바탕으로 합니다.",
    featuresTitle: "이런 걸 할 수 있어요",
    f1Title: "라이브러리 대시보드",
    f1Body: "자주 듣는 아티스트·장르·무드·오디오 특성·앨범 몰입도를 한눈에.",
    f2Title: "취향 DNA",
    f2Body: "10대의 각인 코어와 익숙함↔신선함 지수 — 음악 심리학 기반.",
    f3Title: "아티스트 맵",
    f3Body: "내 아티스트들이 어떻게 묶이는지 한눈에. 안 들어본 연관 아티스트도 한 번에 추가.",
    f4Title: "추천",
    f4Body: "5가지 발견 모드, 스와이프로 평가 — 평가에 따라 다음 추천이 달라져요.",
    howTitle: "사용 방법",
    s1: "크롬 확장프로그램 설치",
    s2: "유튜브 뮤직 좋아요 곡 가져오기",
    s3: "취향 DNA·아티스트 맵·추천 둘러보기",
    galleryTitle: "내 음악, 하나의 캐릭터로",
    gallerySubtitle:
      "좋아요한 곡들을 공유할 수 있는 음악 캐릭터로 만들어 줘요. 아래는 예시예요.",
    footer: "연구를 바탕으로 만든 개인용 음악 취향 도구",
  },
};

export const dicts: Record<Locale, Dict> = { en, ko };

/** The message dictionary for a locale. */
export function getDict(locale: Locale): Dict {
  return dicts[locale];
}
