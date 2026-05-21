"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { recommendDict } from "@/lib/i18n/recommend";

/** Picks a recommendation flavour and generates a fresh batch. */
export function ModePicker({ locale }: { locale: Locale }) {
  const t = recommendDict(locale);
  const MODES = [
    { id: "mix", emoji: "🎲", label: t.modeMixLabel, hint: t.modeMixHint },
    { id: "song", emoji: "❤️", label: t.modeSongLabel, hint: t.modeSongHint },
    { id: "genre", emoji: "🎼", label: t.modeGenreLabel, hint: t.modeGenreHint },
    { id: "unheard", emoji: "🧭", label: t.modeUnheardLabel, hint: t.modeUnheardHint },
    { id: "indie", emoji: "💎", label: t.modeIndieLabel, hint: t.modeIndieHint },
  ];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function generate(mode: string) {
    setBusy(mode);
    try {
      await fetch("/api/recommend/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      router.refresh();
    } catch {
      /* ignore */
    }
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-medium">{t.modePickerTitle}</p>
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => generate(m.id)}
            disabled={busy != null}
            title={m.hint}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm transition-colors hover:border-emerald-500/50 hover:bg-white/10 disabled:opacity-40"
          >
            {busy === m.id ? t.modeMakingShort : `${m.emoji} ${m.label}`}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">{t.modePickerHint}</p>
    </section>
  );
}
