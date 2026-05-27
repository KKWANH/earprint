import type { Locale } from "../i18n";

const en = {
  back: "← Back",
  inLibrary: (n: number) =>
    `${n} liked ${n === 1 ? "track" : "tracks"} in this genre`,
  notInLibrary: "None of your liked tracks are tagged with this genre yet",
  about: "About this genre",
  aboutEmpty: "No description available for this genre yet.",
  aboutWarming: "Pulling a description together — refresh in a moment.",
  topArtists: "Defining artists",
  topTracks: "Essential tracks",
  yourTracks: "Your tracks in this genre",
  allGenres: "All genres →",
};

const ko: typeof en = {
  back: "← 뒤로",
  inLibrary: (n: number) => `이 장르의 좋아요 곡 ${n}곡`,
  notInLibrary: "이 장르의 좋아요 곡 없음",
  about: "장르 소개",
  aboutEmpty: "이 장르의 설명이 아직 없습니다.",
  aboutWarming: "설명을 가져오는 중 — 잠시 후 새로고침해 주세요.",
  topArtists: "대표 아티스트",
  topTracks: "대표곡",
  yourTracks: "내 라이브러리의 이 장르 곡",
  allGenres: "전체 장르 보기 →",
};

export function genreDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
