import type { Locale } from "../i18n";

const en = {
  back: "← Back",
  inLibrary: (n: number) =>
    `${n} liked ${n === 1 ? "track" : "tracks"} in this genre`,
  notInLibrary: "None of your liked tracks are tagged with this genre yet",
  about: "About this genre",
  aboutEmpty: "No description available for this genre yet.",
  topArtists: "Defining artists",
  topTracks: "Essential tracks",
  yourTracks: "Your tracks in this genre",
};

const ko: typeof en = {
  back: "← 뒤로",
  inLibrary: (n: number) => `이 장르의 좋아요한 곡 ${n}개`,
  notInLibrary: "아직 이 장르로 태그된 좋아요 곡이 없어요",
  about: "장르 소개",
  aboutEmpty: "아직 이 장르의 설명이 없습니다.",
  topArtists: "대표 아티스트",
  topTracks: "대표곡",
  yourTracks: "내 라이브러리의 이 장르 곡",
};

export function genreDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
