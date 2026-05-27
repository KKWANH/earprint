import type { Locale } from "../i18n";
import type { CanvasShareStrings } from "@/components/CanvasShareMenu";

/**
 * Shared share-menu copy used by every canvas-export widget (artist map,
 * taste constellation, future zodiac card export, …). One source of truth
 * for these strings — when the wording is tuned in one place the others
 * pick it up for free.
 *
 * The map and profile dicts both used to carry their own copy of these
 * strings; that's wasteful and drifts in translation reviews. Reach for
 * this dict from any new canvas export point instead.
 */

const en: CanvasShareStrings = {
  share: "Share",
  shareTitle: "Save or share",
  shareDownload: "Download PNG",
  shareCopyImage: "Copy image",
  shareCopyEmbed: "Copy HTML embed",
  shareCopied: "Copied!",
  shareFailed: "Copy failed — your browser may not allow clipboard images.",
  shareEmbedHint:
    "Paste into a blog post (Tistory, Velog, Notion, Medium…). The image links back to Earprint.",
};

const ko: CanvasShareStrings = {
  share: "공유",
  shareTitle: "저장 / 공유",
  shareDownload: "PNG 다운로드",
  shareCopyImage: "이미지 복사",
  shareCopyEmbed: "HTML 코드 복사",
  shareCopied: "복사 완료!",
  shareFailed: "복사 실패 — 브라우저가 이미지 클립보드를 막은 듯합니다.",
  shareEmbedHint:
    "블로그 글(티스토리, 벨로그, 노션, 미디엄 등)에 붙여넣기. 이미지를 클릭하면 Earprint 로 연결됩니다.",
};

export function canvasShareDict(locale: Locale): CanvasShareStrings {
  return locale === "ko" ? ko : en;
}
