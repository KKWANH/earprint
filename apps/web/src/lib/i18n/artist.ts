import type { Locale } from "../i18n";

const en = {
  back: "← Back",
  inLibrary: (n: number) => `${n} liked ${n === 1 ? "track" : "tracks"} in your library`,
  notInLibrary: "Not in your library yet",
  notInLibraryHint:
    "This artist isn't in your library. Add them and their top tracks become liked songs.",

  affinityPrompt: "How much do you like this artist?",
  affinityNormal: "Normal",
  affinityLike: "Like",
  affinityFavorite: "Favorite",
  affinitySaved: "Saved",

  addNormal: "♪ Heard of them",
  addLike: "★ Like them",
  addFavorite: "★★ Favorite",
  added: "Added to your library",
  adding: "Adding…",
  addFailed: "Couldn't add — try again.",

  genres: "Genres",
  moods: "Moods",
  audioFeel: "Audio feel",
  feelEnergy: "Energy",
  feelTempo: "Tempo",
  feelAcoustic: "Acoustic",
  tracks: "Tracks",
  albumNone: "Singles & others",
  related: "Related artists",
  relatedEmpty: "No related artists found.",
};

const ko: typeof en = {
  back: "← 뒤로",
  inLibrary: (n: number) => `라이브러리에 좋아요한 곡 ${n}곡`,
  notInLibrary: "아직 라이브러리에 없는 아티스트",
  notInLibraryHint:
    "이 아티스트는 라이브러리에 없어요. 추가하면 대표곡이 좋아요 곡으로 들어갑니다.",

  affinityPrompt: "이 아티스트를 얼마나 좋아하세요?",
  affinityNormal: "보통",
  affinityLike: "좋아함",
  affinityFavorite: "최애",
  affinitySaved: "저장됨",

  addNormal: "♪ 들어봤어요",
  addLike: "★ 좋아해요",
  addFavorite: "★★ 최애예요",
  added: "라이브러리에 추가됨",
  adding: "추가하는 중…",
  addFailed: "추가하지 못했어요 — 다시 시도해 주세요.",

  genres: "장르",
  moods: "무드",
  audioFeel: "오디오 특성",
  feelEnergy: "에너지",
  feelTempo: "템포",
  feelAcoustic: "어쿠스틱",
  tracks: "수록곡",
  albumNone: "싱글·기타",
  related: "비슷한 아티스트",
  relatedEmpty: "비슷한 아티스트를 찾지 못했어요.",
};

export function artistDict(locale: Locale) {
  return locale === "ko" ? ko : en;
}
