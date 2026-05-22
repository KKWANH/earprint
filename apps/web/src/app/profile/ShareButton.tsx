"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";

/** Copies the public share link and links to the share page. */
export function ShareButton({ shareId, locale }: { shareId: string; locale: Locale }) {
  const t = profileDict(locale);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${shareId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the Open link still works */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={copy}
        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900"
      >
        {copied ? `✓ ${t.shareCopied}` : `🔗 ${t.shareCopy}`}
      </button>
      <a
        href={`/s/${shareId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:text-white"
      >
        {t.shareOpen} ↗
      </a>
      <a
        href={`/s/${shareId}/opengraph-image`}
        download="earprint.png"
        className="rounded-md border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:text-white"
      >
        {t.shareImage}
      </a>
    </div>
  );
}
