"use client";

import { useState, type RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import { mapDict } from "@/lib/i18n/map";

/**
 * Share controls for the artist map. Three modes:
 *   • Download PNG — saves earprint-artist-map.png
 *   • Copy image  — puts a PNG on the clipboard (paste into chat / Notion)
 *   • Copy HTML   — full <a><img data:…/></a> snippet for blog posts
 *
 * The HTML embed inlines the image as base64 so the user doesn't need a
 * separate image host. Works in every blog editor we've checked
 * (Tistory, Velog, Naver Blog, Medium, Substack, Notion paste-as-html).
 * Down side: the snippet can be ~200–500 KB for a busy map — some editors
 * will silently truncate or upload the inline data to their CDN.
 */
export function ShareMenu({
  canvasRef,
  locale,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  locale: Locale;
}) {
  const t = mapDict(locale);
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
      a.download = "earprint-artist-map.png";
      a.click();
      URL.revokeObjectURL(url);
      setNote(t.shareCopied);
    } catch {
      setNote(t.shareFailed);
    }
    setBusy(false);
  }

  async function copyImage() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await snapshot();
      if (!blob) throw new Error("no canvas");
      // ClipboardItem with PNG works on Chromium + Firefox 127+ + Safari 13.1+.
      // Older browsers throw — we surface that as t.shareFailed and the user
      // can fall back to Download instead.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setNote(t.shareCopied);
    } catch {
      setNote(t.shareFailed);
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
      // Wrap in <a> so the image acts as a backlink to Earprint when the
      // user pastes into a blog. style="max-width" keeps it from blowing
      // out the post layout on wide editors.
      const html =
        `<a href="https://earprint.kwanho.dev" target="_blank" rel="noopener">` +
        `<img src="${dataUrl}" alt="My music taste map — Earprint" ` +
        `style="max-width:640px;width:100%;border-radius:12px;display:block"/></a>`;
      await navigator.clipboard.writeText(html);
      setNote(t.shareCopied);
    } catch {
      setNote(t.shareFailed);
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
        🔗 {t.share}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-64 overflow-hidden rounded-lg border border-white/10 bg-black/90 text-xs backdrop-blur"
          // Click outside doesn't close — keep it simple. User clicks the
          // 🔗 Share button again to toggle, or just clicks an action.
        >
          <p className="border-b border-white/10 px-3 py-2 font-medium text-neutral-300">
            {t.shareTitle}
          </p>
          <button
            onClick={downloadPng}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
          >
            ⬇ {t.shareDownload}
          </button>
          <button
            onClick={copyImage}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
          >
            📋 {t.shareCopyImage}
          </button>
          <button
            onClick={copyEmbed}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-neutral-300 hover:bg-white/10 disabled:opacity-50"
          >
            🔗 {t.shareCopyEmbed}
          </button>
          <p className="border-t border-white/10 px-3 py-2 text-[10px] leading-snug text-neutral-500">
            {t.shareEmbedHint}
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
