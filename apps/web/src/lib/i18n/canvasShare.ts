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
  shareCopyEmbed: "Copy HTML (static)",
  shareCopyIframe: "Copy interactive embed",
  shareCopied: "Copied!",
  shareFailed: "Copy failed — your browser may not allow clipboard images.",
  shareEmbedHint:
    "Static = a PNG that opens the map. Interactive = an iframe with pan + zoom + hover. Paste into Tistory, Velog, Notion, Medium…",
};

const ko: CanvasShareStrings = {
  share: "공유",
  shareTitle: "저장 / 공유",
  shareDownload: "PNG 다운로드",
  shareCopyImage: "이미지 복사",
  shareCopyEmbed: "HTML 복사 (정적)",
  shareCopyIframe: "인터랙티브 임베드 복사",
  shareCopied: "복사 완료!",
  shareFailed: "복사 실패 — 브라우저가 이미지 클립보드를 막은 듯합니다.",
  shareEmbedHint:
    "정적 = 클릭하면 맵으로 가는 PNG. 인터랙티브 = pan·zoom·hover 가능한 iframe. 티스토리·벨로그·노션·미디엄 등에 붙여넣기.",
};

export function canvasShareDict(locale: Locale): CanvasShareStrings {
  return locale === "ko" ? ko : en;
}
