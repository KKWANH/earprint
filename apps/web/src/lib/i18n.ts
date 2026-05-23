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
    tagline: "Your YouTube Music taste, analyzed.",
    intro:
      "Earprint takes the songs you liked on YouTube Music and shows you your taste — top artists, genres, an artist map, a psychology-style profile, and recommendations.",
    ctaIn: "Open your dashboard →",
    ctaOut: "Sign in with Google",
    signedInAs: "Signed in as",
    featuresTitle: "What's inside",
    f1Title: "Library dashboard",
    f1Body: "Top artists, genres, moods, audio feel, album depth.",
    f2Title: "Taste DNA",
    f2Body: "Reminiscence-bump imprint core and a familiarity↔novelty index.",
    f3Title: "Artist map",
    f3Body: "An interactive map of your artists, with unheard related artists you can add.",
    f4Title: "Recommendations",
    f4Body: "Five discovery modes, swipe to rate.",
    howTitle: "How it works",
    s1: "Install the Chrome extension",
    s2: "Sync your liked songs from YouTube Music",
    s3: "Explore your Taste DNA, artist map and recommendations",
    galleryTitle: "Sample outputs",
    gallerySubtitle: "Three example personas from an Earprint analysis.",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    tagline: "A personal music-taste tool",
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
    tagline: "내 음악 취향 분석하기",
    intro:
      "유튜브 뮤직 좋아요 곡을 분석합니다. 자주 듣는 아티스트·장르·무드, 아티스트 맵, 심리 프로파일, 추천.",
    ctaIn: "대시보드 열기 →",
    ctaOut: "Google 로 로그인",
    signedInAs: "로그인:",
    featuresTitle: "주요 기능",
    f1Title: "라이브러리 대시보드",
    f1Body: "자주 듣는 아티스트·장르·무드·오디오 특성·앨범 몰입도.",
    f2Title: "취향 DNA",
    f2Body: "10대 각인 코어와 익숙함↔신선함 지수.",
    f3Title: "아티스트 맵",
    f3Body: "내 아티스트들의 관계, 안 들어본 연관 아티스트 추가 가능.",
    f4Title: "추천",
    f4Body: "5가지 모드, 스와이프로 평가.",
    howTitle: "사용 방법",
    s1: "크롬 확장프로그램 설치",
    s2: "유튜브 뮤직 좋아요 곡 가져오기",
    s3: "취향 DNA·아티스트 맵·추천 둘러보기",
    galleryTitle: "결과 예시",
    gallerySubtitle: "Earprint 분석 결과 예시 3가지.",
  },
  footer: {
    privacy: "개인정보처리방침",
    terms: "이용약관",
    tagline: "개인용 음악 취향 분석 도구",
  },
};

export const dicts: Record<Locale, Dict> = { en, ko };

/** The message dictionary for a locale. */
export function getDict(locale: Locale): Dict {
  return dicts[locale];
}
