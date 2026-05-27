"use client";

import { useState, type RefObject } from "react";

/**
 * Generic share controls for any HTML5 canvas the page is rendering
 * (artist map, taste constellation, future zodiac card, …).
 *
 * Three modes, picked because they're the three sharing flows people
 * actually use after they've made a chart they like:
 *   • Download PNG — saves <filename>.png to disk
 *   • Copy image  — puts a PNG on the clipboard (paste into chat / Notion)
 *   • Copy HTML   — full <a><img data:…/></a> snippet for blog posts
 *
 * The HTML embed inlines the image as base64 so the user doesn't need a
 * separate image host. The snippet can be ~200–500 KB for a busy canvas —
 * most blog editors accept it as paste-as-html (Tistory, Velog, Naver Blog,
 * Medium, Substack, Notion). Some Substack-style editors will silently
 * upload the inline data to their CDN, which is fine.
 *
 * Strings are passed in as a prop so the same widget can sit on any page
 * with that page's i18n. The shared dict shape is `CanvasShareStrings` so
 * the caller's compiler enforces the keys.
 */

export interface CanvasShareStrings {
  /** Pill label on the closed-state button. */
  share: string;
  shareTitle: string;
  shareDownload: string;
  shareCopyImage: string;
  shareCopyEmbed: string;
  shareCopyIframe?: string;
  shareCopied: string;
  shareFailed: string;
  shareEmbedHint: string;
}

export function CanvasShareMenu({
  canvasRef,
  strings,
  filename,
  embedAlt,
  embedHref = "https://earprint.kwanho.dev/map",
  iframeUrl,
  iframeSize = { width: 640, height: 480 },
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  strings: CanvasShareStrings;
  /** Without extension — `.png` is appended. e.g. "earprint-artist-map" */
  filename: string;
  /** Used as the <img alt> in the HTML embed snippet. */
  embedAlt: string;
  /** Link the static-PNG embed image points to. Defaults to the
   *  artist map page so a viewer who clicks the static image lands on
   *  the interactive canvas. Previously defaulted to the marketing
   *  landing which surfaced as "click does nothing meaningful". */
  embedHref?: string;
  /** When provided, surfaces a "Copy iframe embed" option that emits
   *  an `<iframe src=...>` snippet wrapping a fully-interactive page
   *  (pan / zoom / hover all work in the host blog). The URL should
   *  point at an embed-friendly route (e.g.
   *  /map/embed/<shareId>). Omitted = no iframe option shown. */
  iframeUrl?: string;
  /** Default iframe dimensions in the snippet. Most blog editors
   *  resize via CSS anyway; this is just a sensible starting size. */
  iframeSize?: { width: number; height: number };
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function snapshot(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
  }

  async function downloadPng() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await snapshot();
      if (!blob) throw new Error("no canvas");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(strings.shareCopied);
    } catch {
      setNote(strings.shareFailed);
    }
    setBusy(false);
  }

  async function copyImage() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await snapshot();
      if (!blob) throw new Error("no canvas");
      // ClipboardItem with PNG: Chromium + Firefox 127+ + Safari 13.1+.
      // Older browsers throw — we show shareFailed so the user can fall
      // back to Download instead.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setNote(strings.shareCopied);
    } catch {
      setNote(strings.shareFailed);
    }
    setBusy(false);
  }

  async function copyEmbed() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await snapshot();
      if (!blob) throw new Error("no canvas");
      const dataUrl = await blobToDataUrl(blob);
      // Wrap in <a> so the image acts as a backlink when pasted into a
      // blog. style="max-width" keeps it from blowing out the post
      // layout on wide editors. cursor:zoom-in hints to viewers that
      // clicking the static image opens the interactive map page.
      const html =
        `<a href="${embedHref}" target="_blank" rel="noopener" ` +
        `title="Open interactive map">` +
        `<img src="${dataUrl}" alt="${escapeAttr(embedAlt)}" ` +
        `style="max-width:640px;width:100%;border-radius:12px;` +
        `display:block;cursor:zoom-in"/></a>`;
      await navigator.clipboard.writeText(html);
      setNote(strings.shareCopied);
    } catch {
      setNote(strings.shareFailed);
    }
    setBusy(false);
  }

  /** Copy a fully-interactive iframe snippet (pan / zoom / hover all
   *  work inside the host blog). The embedded page is the same canvas
   *  the owner sees on /map but stripped of nav chrome. Available only
   *  when the parent passed `iframeUrl`. */
  async function copyIframe() {
    if (!iframeUrl) return;
    setBusy(true);
    setNote(null);
    try {
      const html =
        `<iframe src="${iframeUrl}" ` +
        `width="${iframeSize.width}" height="${iframeSize.height}" ` +
        `frameborder="0" loading="lazy" ` +
        `title="${escapeAttr(embedAlt)}" ` +
        `style="max-width:100%;border:0;border-radius:12px"></iframe>`;
      await navigator.clipboard.writeText(html);
      setNote(strings.shareCopied);
    } catch {
      setNote(strings.shareFailed);
    }
    setBusy(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setNote(null);
        }}
        className="rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-neutral-300 backdrop-blur hover:bg-white/10"
      >
        🔗 {strings.share}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1.5 w-64 overflow-hidden rounded-lg border border-white/10 bg-black/90 text-xs backdrop-blur"
          // Click-outside intentionally not wired — keeps the popup
          // dismissable only by the toggle button or by picking an action.
        >
          <p className="border-b border-white/10 px-3 py-2 font-medium text-neutral-300">
            {strings.shareTitle}
          </p>
          <button
            onClick={() => { void downloadPng(); }}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
          >
            ⬇ {strings.shareDownload}
          </button>
          <button
            onClick={() => { void copyImage(); }}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
          >
            📋 {strings.shareCopyImage}
          </button>
          <button
            onClick={() => { void copyEmbed(); }}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
          >
            🔗 {strings.shareCopyEmbed}
          </button>
          {iframeUrl && (
            <button
              onClick={() => { void copyIframe(); }}
              disabled={busy}
              className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
            >
              🪟 {strings.shareCopyIframe ?? "Copy interactive embed"}
            </button>
          )}
          <p className="border-t border-white/10 px-3 py-2 text-[10px] leading-snug text-neutral-500">
            {strings.shareEmbedHint}
          </p>
          {note && (
            <p className="border-t border-white/10 px-3 py-2 text-emerald-300">
              {note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("FileReader failed"));
    r.readAsDataURL(blob);
  });
}

/** Minimal attribute escaping for the alt text injection. */
function escapeAttr(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
