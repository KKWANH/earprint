"use client";

import type { Locale } from "@/lib/i18n";
import { libraryDict } from "@/lib/i18n/library";
import { useAudioPlayer } from "@/lib/useAudioPlayer";

/** 30-second Deezer preview button. */
export function PreviewButton({
  deezerId,
  locale,
}: {
  deezerId: number | null;
  locale: Locale;
}) {
  const t = libraryDict(locale);
  const { playing, loading, toggle } = useAudioPlayer(deezerId);
  if (!deezerId) return null;

  return (
    <button
      onClick={toggle}
      className="rounded px-1.5 text-xs text-neutral-400 hover:text-white"
      title={t.previewTitle}
    >
      {loading ? "…" : playing ? "⏸" : "▶"}
    </button>
  );
}
