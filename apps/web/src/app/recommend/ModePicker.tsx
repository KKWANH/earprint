"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { recommendDict } from "@/lib/i18n/recommend";

type ModeId = "mix" | "song" | "genre" | "unheard" | "indie";

/** Picks a recommendation flavour and generates a fresh batch.
 *  `currentMode` (if known) highlights the mode the top-of-deck card came
 *  from, so the user can see at a glance which flavour they're rating. */
export function ModePicker({
  locale,
  currentMode,
}: {
  locale: Locale;
  currentMode?: ModeId | null;
}) {
  const t = recommendDict(locale);
  const MODES: { id: ModeId; emoji: string; label: string; hint: string }[] = [
    { id: "mix", emoji: "🎲", label: t.modeMixLabel, hint: t.modeMixHint },
    { id: "song", emoji: "❤️", label: t.modeSongLabel, hint: t.modeSongHint },
    { id: "genre", emoji: "🎼", label: t.modeGenreLabel, hint: t.modeGenreHint },
    { id: "unheard", emoji: "🧭", label: t.modeUnheardLabel, hint: t.modeUnheardHint },
    { id: "indie", emoji: "💎", label: t.modeIndieLabel, hint: t.modeIndieHint },
  ];
  // Hovered/active mode whose hint is shown in the description bar.
  const [hovered, setHovered] = useState<ModeId | null>(null);
  const visible = hovered ?? currentMode ?? null;
  const visibleMode = MODES.find((m) => m.id === visible);

  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function generate(mode: ModeId) {
    setBusy(mode);
    setNote(null);
    try {
      const res = await fetch("/api/recommend/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = (await res.json()) as { added?: number };
      if (d.added && d.added > 0) router.refresh();
      else setNote(t.modeNoNew);
    } catch {
      /* ignore */
    }
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-medium">{t.modePickerTitle}</p>
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const isActive = currentMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => generate(m.id)}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(m.id)}
              onBlur={() => setHovered(null)}
              disabled={busy != null}
              title={m.hint}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                isActive
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "border-white/10 bg-black/30 text-neutral-300 hover:border-emerald-500/50 hover:bg-white/10"
              }`}
            >
              {busy === m.id ? t.modeMakingShort : `${m.emoji} ${m.label}`}
            </button>
          );
        })}
      </div>
      {/* Inline description — replaces the old desktop-only tooltip so
          mobile users get the same per-mode hint. */}
      <p className="min-h-[1.25rem] text-[11px] leading-snug text-neutral-400">
        {visibleMode ? visibleMode.hint : t.modePickerHint}
      </p>
      {note && <p className="text-xs text-amber-400">{note}</p>}
    </section>
  );
}
