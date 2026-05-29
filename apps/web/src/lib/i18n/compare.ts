import type { Locale } from "@/lib/i18n";

/** Tier keys mirror compareTaste()'s result.tier union. */
type Tier = "twin" | "close" | "some" | "distant";

const en = {
  signInGoogle: "Sign in with Google",

  // entry form (no `with` target yet)
  title: "Compare taste",
  entryBody:
    "Paste a friend's share link to see how much your tastes overlap. (Only works when they've shared their profile.)",
  sharePlaceholder: "Share link or share id",
  compare: "Compare",
  makeOwnShare: "Make your own share link from the Psychology (/profile) page.",

  // share not found
  shareNotFound: "Share link not found",
  shareNotFoundBody:
    "Double-check the link, or ask them to enable profile sharing.",
  tryAgain: "← Try again",

  // comparing with self
  thatsYou: "Hey, that's you 🙂",
  thatsYouBody: "Paste a friend's share link to see how alike your tastes are.",
  compareSomeoneElse: "Compare with someone else",

  // result
  compareSomeoneElseShort: "Compare someone else",
  tier: {
    twin: "Taste twins",
    close: "Pretty close",
    some: "Some overlap",
    distant: "Quite different",
  } as Record<Tier, string>,
  breakdown: (artists: number, genres: number) =>
    `artists ${artists}% · genres ${genres}%`,
  soundSuffix: (sound: number) => ` · sound ${sound}%`,
  sharedArtistsTitle: "Artists you both love",
  sharedGenresTitle: "Genres you share",
  noOverlap: "Almost no overlap — a chance to discover new music from each other!",
};

const ko: typeof en = {
  signInGoogle: "Google 로 로그인",

  title: "취향 비교",
  entryBody:
    "친구의 공유 링크를 붙여넣으면 두 사람의 취향이 얼마나 겹치는지 보여드려요. (상대가 프로필을 공유했을 때만 가능)",
  sharePlaceholder: "공유 링크 또는 share id",
  compare: "비교하기",
  makeOwnShare: "내 공유 링크는 심리분석(/profile) 페이지에서 만들 수 있어요.",

  shareNotFound: "공유 링크를 찾을 수 없어요",
  shareNotFoundBody:
    "링크가 맞는지 확인하거나, 상대에게 프로필 공유를 켜달라고 해보세요.",
  tryAgain: "← 다시 시도",

  thatsYou: "어라, 본인인걸요? 🙂",
  thatsYouBody:
    "친구의 공유 링크를 붙여넣으면 두 사람 취향이 얼마나 닮았는지 볼 수 있어요.",
  compareSomeoneElse: "다른 사람과 비교하기",

  compareSomeoneElseShort: "다른 사람과 비교",
  tier: {
    twin: "취향 쌍둥이",
    close: "꽤 비슷함",
    some: "약간 겹침",
    distant: "꽤 다름",
  } as Record<Tier, string>,
  breakdown: (artists, genres) =>
    `아티스트 ${artists}% · 장르 ${genres}%`,
  soundSuffix: (sound) => ` · 사운드 ${sound}%`,
  sharedArtistsTitle: "공통 아티스트",
  sharedGenresTitle: "공통 장르",
  noOverlap:
    "공통점이 거의 없네요 — 서로의 라이브러리에서 새 곡을 발견할 기회!",
};

export function compareDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
