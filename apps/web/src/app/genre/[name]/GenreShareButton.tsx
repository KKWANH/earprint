"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { genreDict } from "@/lib/i18n/genre";

/**
 * Genre page share button. Uses navigator.share() on mobile / Safari
 * (native sheet with messaging / mail / social apps) and falls back
 * to clipboard.writeText elsewhere. Pattern mirrors the existing
 * ShareChampionButton on /worldcup/champion to keep the share UX
 * consistent across the product surface.
 */
export function GenreShareButton({
  name,
  locale,
}: {
  name: string;
  locale: Locale;
}) {
  const t = genreDict(locale);
  const [state, setState] = useState<"idle" | "copied">("idle");

  async function share() {
    const url = `https://earprint.kwanho.dev/genre/${encodeURIComponent(name.toLowerCase())}`;
    const text = t.shareText(name);
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title: `${name} — Earprint`, text, url });
        return;
      } catch {
        // User cancelled or share unavailable — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setState("copied");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      /* clipboard blocked — silent fail */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-emerald-500/50 hover:text-white"
    >
      {state === "copied" ? t.shareCopied : t.share}
    </button>
  );
}
