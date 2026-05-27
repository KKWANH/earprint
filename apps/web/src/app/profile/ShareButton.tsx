"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";

/**
 * Public-share controls. Three paths in order of preference:
 *
 *   1. navigator.share() — fires the OS share sheet on mobile (iOS
 *      Messages / KakaoTalk / Twitter / WhatsApp / etc.). Single tap,
 *      no copy-paste, and the share target gets a real link preview.
 *      This is the path most users actually want on phone.
 *   2. Clipboard copy — desktop fallback, brief "✓ copied" toast.
 *   3. Plain "Open" link — last-resort fallback for environments where
 *      both of the above fail (privacy-locked browsers, etc.).
 *
 * A separate "Save image" link triggers the OpenGraph PNG download
 * so users can share the visual card on platforms that strip link
 * previews (e.g. Instagram Stories).
 */
export function ShareButton({ shareId, locale }: { shareId: string; locale: Locale }) {
  const t = profileDict(locale);
  const [copied, setCopied] = useState(false);

  async function shareOrCopy() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/s/${shareId}`
        : `https://earprint.kwanho.dev/s/${shareId}`;
    const shareText =
      locale === "ko"
        ? "내 음악 취향을 Earprint로 분석했어요"
        : "I analysed my music taste on Earprint";

    // Prefer the native share sheet when the runtime exposes it. On iOS
    // Safari and most Android Chromes this opens KakaoTalk / Messages /
    // Twitter / share-to-Instagram directly with a real link preview —
    // strictly better UX than the clipboard fallback.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Earprint", text: shareText, url });
        return;
      } catch {
        // User dismissed the share sheet, or the browser rejected the
        // call (some embedded WebViews advertise share but throw).
        // Fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard also unavailable — the Open link is the last resort */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={shareOrCopy}
        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900"
      >
        {copied ? `✓ ${t.shareCopied}` : `📤 ${t.shareCopy}`}
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
