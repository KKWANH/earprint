"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { Bracket, type Rec } from "../../Bracket";

/**
 * Lens picker → Gemini curation call → Bracket runner.
 *
 * Lens chips are pre-baked. The textarea lets the user pass an
 * arbitrary prompt ("songs that remind me of train rides", "stuff I
 * used to obsess over in 2018"). The form submits to /api/worldcup
 * /curate and slots the returned candidates into a Bracket.
 */
// Lens id + emoji are locale-independent; the label comes from
// worldcupDict so a 3rd language is additive.
const LENS_META = [
  { id: "favourites", emoji: "✨", labelKey: "curateLensFavourites" },
  { id: "recent", emoji: "🌱", labelKey: "curateLensRecent" },
  { id: "forgotten", emoji: "📼", labelKey: "curateLensForgotten" },
  { id: "sad", emoji: "💔", labelKey: "curateLensSad" },
  { id: "pumpup", emoji: "🔥", labelKey: "curateLensPumpup" },
  { id: "latenight", emoji: "🌙", labelKey: "curateLensLatenight" },
  { id: "guilty", emoji: "🤫", labelKey: "curateLensGuilty" },
] as const;

export function CurateForm({
  size,
  locale,
}: {
  size: 4 | 8 | 16 | 32;
  locale: Locale;
}) {
  const t = worldcupDict(locale);
  const lenses = LENS_META.map((l) => ({
    id: l.id,
    emoji: l.emoji,
    label: t[l.labelKey],
  }));
  const [chosenLens, setChosenLens] = useState<string | null>(null);
  const [customLens, setCustomLens] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Rec[] | null>(null);

  const activeLensLabel =
    chosenLens === "_custom"
      ? customLens.trim()
      : chosenLens
        ? lenses.find((l) => l.id === chosenLens)?.label ?? ""
        : "";

  async function curate() {
    if (!activeLensLabel) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/worldcup/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lens: activeLensLabel, size }),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        candidates?: Rec[];
        error?: string;
      };
      if (!res.ok || !d.ok || !Array.isArray(d.candidates)) {
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      setCandidates(d.candidates);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (candidates) {
    return (
      <>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
            {t.curateLensBadge}
          </span>
          <span className="line-clamp-1">{activeLensLabel}</span>
          <button
            onClick={() => setCandidates(null)}
            className="ml-auto rounded-md border border-white/10 px-2 py-0.5 text-[10px] hover:bg-white/10"
          >
            {t.curateChangeLens}
          </button>
        </div>
        <Bracket
          initial={candidates}
          rated={0}
          likes={0}
          dislikes={0}
          locale={locale}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {lenses.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setChosenLens(l.id)}
            disabled={busy}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
              chosenLens === l.id
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-white"
            } disabled:opacity-50`}
          >
            {l.emoji} {l.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setChosenLens("_custom")}
          disabled={busy}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
            chosenLens === "_custom"
              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
              : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-white"
          }`}
        >
          ✍ {t.curateCustom}
        </button>
      </div>
      {chosenLens === "_custom" && (
        <textarea
          value={customLens}
          onChange={(e) => setCustomLens(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={t.curateCustomPlaceholder}
          className="resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      )}
      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void curate()}
        disabled={busy || !activeLensLabel}
        className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
      >
        {busy ? t.curateBusy : t.curateBuild(size)}
      </button>
    </div>
  );
}
