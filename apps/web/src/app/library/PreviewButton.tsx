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
  const { playing, loading, error, toggle } = useAudioPlayer(deezerId);
  if (!deezerId) return null;

  // When preview load failed, show a dimmed "✕" instead of a play button —
  // keeps row width stable but signals nothing will happen on click. Avoids
  // the user re-clicking and re-triggering a doomed fetch.
  if (error) {
    return (
      <span
        className="inline-block rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1 text-sm text-neutral-600"
        title="Preview unavailable"
      >
        ✕
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        void toggle();
      }}
      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-neutral-300 hover:border-emerald-500/50 hover:text-white"
      title={t.previewTitle}
    >
      {loading ? "…" : playing ? "⏸" : "▶"}
    </button>
  );
}
