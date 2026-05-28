"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { worldcupDict } from "@/lib/i18n/worldcup";

/**
 * Resumes an in-progress worldcup. Bracket.tsx stores per-bracket
 * progress in localStorage under keys shaped `pa-wc:{category}:{size}:{firstId}`
 * (lib/worldcup.ts WORLDCUP_SIZES + the bracket's first candidate id).
 * The home page didn't surface these — testers reported losing 5-10
 * minutes of clicking after an accidental nav-away. This component
 * scans localStorage on mount and renders a "Continue tournament"
 * card for every saved bracket.
 *
 * Saved entries include: pattern, round (0-indexed), pairIdx,
 * bracket length, winners length. We don't need the candidate
 * payloads (they live on the bracket page itself); just the cache
 * key carries everything we need to deep-link back.
 */
interface SavedBracket {
  key: string;
  category: string;
  size: number;
  round: number;
  totalRounds: number;
  pairIdx: number;
  pairsInRound: number;
}

const PREFIX = "pa-wc:";

function scanLocalBrackets(): SavedBracket[] {
  if (typeof window === "undefined") return [];
  const out: SavedBracket[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    // Key shape: pa-wc:category:size:firstId
    const rest = key.slice(PREFIX.length);
    const firstColon = rest.indexOf(":");
    if (firstColon < 0) continue;
    const category = rest.slice(0, firstColon);
    const afterCat = rest.slice(firstColon + 1);
    const secondColon = afterCat.indexOf(":");
    if (secondColon < 0) continue;
    const sizeStr = afterCat.slice(0, secondColon);
    const size = Number(sizeStr);
    if (!Number.isFinite(size) || size <= 0) continue;
    let payload: {
      round?: number;
      pairIdx?: number;
      bracket?: unknown[];
    };
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      payload = JSON.parse(raw);
    } catch {
      continue;
    }
    const round = Number(payload.round ?? 0);
    const pairIdx = Number(payload.pairIdx ?? 0);
    const bracketLen = Array.isArray(payload.bracket) ? payload.bracket.length : 0;
    // totalRounds derived from initial size: log2(size). bracketLen is
    // the current round's pair count × 2, which differs from initial
    // once rounds advance — use size for the headline.
    const totalRounds = Math.log2(size) | 0;
    const pairsInRound = Math.max(1, bracketLen / 2);
    out.push({ key, category, size, round, totalRounds, pairIdx, pairsInRound });
  }
  // Most-recently-saved first. We don't have a saved-at timestamp;
  // approximate by "deepest round first" so a near-final bracket
  // surfaces above a barely-started one.
  out.sort((a, b) => b.round - a.round);
  return out;
}

/**
 * Takes a `locale` (plain string) rather than a labels object. The
 * earlier shape passed `roundLabel`/`pairLabel` functions down from
 * the server component — React Server Components cannot serialize
 * functions across the server→client boundary, which crashed the RSC
 * stream with a non-localised digest. Computing labels client-side
 * via `worldcupDict(locale)` keeps the prop fully serialisable.
 */
export function InProgressCard({ locale }: { locale: Locale }) {
  const [items, setItems] = useState<SavedBracket[]>([]);
  const t = worldcupDict(locale);
  // Hydration: scan only client-side. Empty list while SSR / on first
  // paint so the section doesn't flash an empty header.
  useEffect(() => {
    setItems(scanLocalBrackets());
  }, []);

  function dismiss(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* private mode etc — fall through */
    }
    setItems((arr) => arr.filter((it) => it.key !== key));
  }

  if (items.length === 0) return null;

  const catLabels: Record<string, string> = {
    library: t.catLibraryLabel,
    recent: t.catRecentLabel,
    forgotten: t.catForgottenLabel,
    genre: t.catGenreLabel,
    discover: t.catDiscoverLabel,
    mix: t.catMixLabel,
    liked: t.catLikedLabel,
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        {t.inProgressTitle}
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const catLabel = catLabels[it.category] ?? it.category;
          // Genre bracket uses /worldcup/genre/[size] route, every
          // other category uses /worldcup/[cat]/[size]. The router
          // file structure dictates the URL shape — kept the
          // distinction here so the deep link actually works.
          const href =
            it.category === "genre"
              ? `/worldcup/genre/${it.size}`
              : `/worldcup/${it.category}/${it.size}`;
          return (
            <div
              key={it.key}
              className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-neutral-950 to-neutral-900 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 text-sm font-semibold">
                  <span className="text-amber-200">{catLabel}</span>
                  <span className="text-xs text-neutral-500">· {it.size}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-400">
                  {t.inProgressRoundLabel(it.round + 1, it.totalRounds)}
                  {" · "}
                  {t.inProgressPairLabel(it.pairIdx + 1, it.pairsInRound)}
                </div>
              </div>
              <Link
                href={href}
                className="rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
              >
                {t.inProgressResume}
              </Link>
              <button
                onClick={() => dismiss(it.key)}
                className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                title={t.inProgressDismiss}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
