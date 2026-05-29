"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { demoDict } from "@/lib/i18n/demo";
import { Bracket, type Rec } from "../worldcup/Bracket";
import { PreviewButton } from "../library/PreviewButton";

/**
 * R38 — interactive demo worldcup. The single biggest onboarding gap
 * (per the R37 audit) was that a visitor couldn't *experience* the
 * core loop without installing the extension + syncing. This lets
 * them play an 8-track bracket on a curated sample set right on
 * /demo — no auth, no DB writes, no localStorage pollution
 * (Bracket only persists when `category` is set, which we omit).
 *
 * Cards carry a real Deezer id (resolved once via the public Deezer
 * search API — R39) so the ▶ button plays a genuine 30s preview, the
 * same component the live app uses. Cover art stays an emoji
 * placeholder (hardcoding CDN URLs would rot); the audio is the part
 * that sells the loop. The point is the *flow* — pick, advance,
 * champion — and a note points to the real app for full-song
 * playback on your own library.
 */
const SAMPLE: Rec[] = [
  { id: "d1", artist: "Queen", title: "Bohemian Rhapsody", coverUrl: null, deezerId: 2347110115, score: 0.95, recType: "song" },
  { id: "d2", artist: "Michael Jackson", title: "Billie Jean", coverUrl: null, deezerId: 3129779, score: 0.9, recType: "song" },
  { id: "d3", artist: "The Beatles", title: "Hey Jude", coverUrl: null, deezerId: 116348412, score: 0.88, recType: "song" },
  { id: "d4", artist: "Nirvana", title: "Smells Like Teen Spirit", coverUrl: null, deezerId: 2179489, score: 0.86, recType: "song" },
  { id: "d5", artist: "Daft Punk", title: "Get Lucky", coverUrl: null, deezerId: 12166290, score: 0.84, recType: "song" },
  { id: "d6", artist: "Adele", title: "Rolling in the Deep", coverUrl: null, deezerId: 68496703, score: 0.82, recType: "song" },
  { id: "d7", artist: "BTS", title: "Dynamite", coverUrl: null, deezerId: 997764782, score: 0.8, recType: "song" },
  { id: "d8", artist: "Fleetwood Mac", title: "Dreams", coverUrl: null, deezerId: 136284842, score: 0.78, recType: "song" },
];

export function DemoWorldcup({ locale }: { locale: Locale }) {
  const t = demoDict(locale);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <section className="flex flex-col items-start gap-2 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-neutral-950 to-neutral-900 p-5">
        <span className="text-2xl">🏆</span>
        <h2 className="text-sm font-bold text-white">{t.wcTitle}</h2>
        <p className="text-xs text-neutral-400">{t.wcBody}</p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          {t.wcStart}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-neutral-950 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-amber-200">{t.wcOpenTitle}</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-white"
        >
          {t.wcClose}
        </button>
      </div>
      <Bracket
        initial={SAMPLE}
        rated={0}
        likes={0}
        dislikes={0}
        locale={locale}
        // Pick button + a real 30s-preview button as siblings (nesting
        // buttons is invalid HTML; PreviewButton stops click
        // propagation so playing never triggers a pick).
        renderCard={(c, onPick) => (
          <div className="relative">
            <button
              type="button"
              onClick={onPick}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900/40 via-neutral-900 to-rose-900/30 p-4 text-center transition-transform hover:scale-[1.02] hover:border-emerald-500/50"
            >
              <span className="text-3xl">🎵</span>
              <span className="line-clamp-2 text-sm font-bold text-white">
                {c.title}
              </span>
              <span className="line-clamp-1 text-xs text-neutral-400">
                {c.artist}
              </span>
            </button>
            <div className="absolute right-2 top-2">
              <PreviewButton deezerId={c.deezerId} locale={locale} />
            </div>
          </div>
        )}
        renderChampion={(champion, onRestart) => (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-900 p-8 text-center">
            <span className="text-5xl">🏆</span>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              {t.wcChampionLabel}
            </p>
            <h3 className="text-2xl font-extrabold">
              {champion.title}
              <span className="block text-base font-medium text-neutral-400">
                {champion.artist}
              </span>
            </h3>
            <p className="max-w-xs text-xs text-neutral-500">{t.wcChampionBody}</p>
            <div className="flex gap-2">
              <button
                onClick={onRestart}
                className="rounded-md border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
              >
                {t.wcAgain}
              </button>
              <Link
                href="/library"
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                {t.wcDoMine}
              </Link>
            </div>
          </div>
        )}
      />
    </section>
  );
}
