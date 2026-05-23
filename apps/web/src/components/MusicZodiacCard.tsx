"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";
import {
  ALL_ZODIACS,
  type MusicZodiac,
  type SignBreakdown,
  type Zodiac,
} from "@/lib/musicZodiac";

/** A few quiet ambient stars in the corners of the sky. */
const AMBIENT_STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 7, y: 12, r: 0.6, o: 0.55 },
  { x: 22, y: 50, r: 0.4, o: 0.4 },
  { x: 92, y: 18, r: 0.7, o: 0.6 },
  { x: 85, y: 46, r: 0.5, o: 0.45 },
  { x: 50, y: 6, r: 0.35, o: 0.35 },
  { x: 95, y: 55, r: 0.55, o: 0.5 },
  { x: 14, y: 32, r: 0.35, o: 0.35 },
  { x: 78, y: 8, r: 0.4, o: 0.4 },
  { x: 4, y: 55, r: 0.45, o: 0.45 },
  { x: 88, y: 32, r: 0.45, o: 0.4 },
];

// VS15 forces text-style presentation of the zodiac symbol so it renders as
// a glyph rather than the platform's emoji image.
const TEXT_STYLE = "︎";

/**
 * The user's zodiac as a cosmic scene; the twelve-sign strip is browsable.
 * Each strip cell shows that sign's match share — even non-winning signs
 * surface "what little of you lives here", and selecting a cell swaps the
 * displayed archetype, blurb and matched tags.
 */
export function MusicZodiacCard({
  data,
  locale,
}: {
  data: MusicZodiac;
  locale: Locale;
}) {
  const t = profileDict(locale);
  const matchedSign = data.zodiac.sign;
  const [active, setActive] = useState<Zodiac>(data.zodiac);
  const isMatched = active.sign === matchedSign;

  // Lookup map for breakdown by sign — used for both the active card and the
  // strip cells. The breakdown array is sorted by share desc but we render
  // the strip in zodiacal order for consistency.
  const bySign = useMemo(() => {
    const m = new Map<string, SignBreakdown>();
    for (const b of data.breakdown) m.set(b.sign, b);
    return m;
  }, [data.breakdown]);

  const activeBreakdown = bySign.get(active.sign);
  const activeShare = activeBreakdown?.share ?? 0;
  const activeMatched = activeBreakdown?.matched ?? [];

  const name = locale === "ko" ? active.nameKo : active.nameEn;
  const archetype = locale === "ko" ? active.archetypeKo : active.archetypeEn;
  const blurb = locale === "ko" ? active.blurbKo : active.blurbEn;

  return (
    <section className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 px-6 py-8 text-center"
        style={{
          background:
            "radial-gradient(ellipse at top, #1e1b4b 0%, #0a0a0b 55%, #1c0a2e 100%)",
        }}
      >
        <CosmicBackground zodiac={active} />

        {!isMatched && (
          <button
            onClick={() => setActive(data.zodiac)}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-black/60"
          >
            ← {data.zodiac.symbol}
            {TEXT_STYLE}
          </button>
        )}

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {t.zodiacHeading}
          </p>
          <div className="mt-3 font-serif text-8xl leading-none text-amber-300 drop-shadow-[0_0_24px_rgba(252,211,77,0.4)]">
            {active.symbol}
            {TEXT_STYLE}
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/55">
            {name}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            {archetype}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/75">
            {blurb}
          </p>
          {/* Per-sign match rate. Even non-winning signs surface their share
              so users see "what little of you lives here". */}
          <p className="mt-3 text-[11px] uppercase tracking-wider text-white/45">
            {t.zodiacMatch} {Math.round(activeShare * 100)}%
          </p>
          {activeMatched.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-white/45">
                {t.zodiacMatched}
              </span>
              {activeMatched.slice(0, 8).map((m) =>
                m.type === "genre" ? (
                  <Link
                    key={`${m.type}:${m.name}`}
                    href={`/genre/${encodeURIComponent(m.name)}`}
                    className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200 hover:bg-amber-500/25"
                  >
                    {m.name}
                  </Link>
                ) : (
                  <span
                    key={`${m.type}:${m.name}`}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70"
                  >
                    {m.name}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ALL_ZODIACS.map((other) => {
          const isMatch = other.sign === matchedSign;
          const isActive = other.sign === active.sign;
          const share = bySign.get(other.sign)?.share ?? 0;
          const pct = Math.round(share * 100);
          return (
            <button
              key={other.sign}
              onClick={() => setActive(other)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors ${
                isMatch
                  ? "border-amber-400/60 bg-amber-500/10 ring-1 ring-amber-400/40"
                  : isActive
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`text-xl leading-none ${
                  isMatch ? "text-amber-300" : isActive ? "text-white" : "text-neutral-500"
                }`}
              >
                {other.symbol}
                {TEXT_STYLE}
              </span>
              <span
                className={`text-[10px] ${
                  isMatch ? "text-amber-200" : isActive ? "text-white" : "text-neutral-500"
                }`}
              >
                {locale === "ko" ? other.nameKo : other.nameEn}
              </span>
              <span
                className={`text-[9px] tabular-nums ${
                  isMatch
                    ? "text-amber-300/80"
                    : pct > 0
                      ? "text-white/55"
                      : "text-neutral-600"
                }`}
              >
                {pct}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Quiet ambient stars + the active sign's constellation drawn across the sky. */
function CosmicBackground({ zodiac }: { zodiac: Zodiac }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {AMBIENT_STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}
      {/* The matched constellation, drawn larger across the sky. */}
      <g transform="translate(20 3) scale(0.6)" opacity="0.7">
        {zodiac.constellation.edges.map(([a, b], i) => {
          const sa = zodiac.constellation.stars[a];
          const sb = zodiac.constellation.stars[b];
          return (
            <line
              key={i}
              x1={sa.x}
              y1={sa.y}
              x2={sb.x}
              y2={sb.y}
              stroke="#fcd34d"
              strokeWidth="0.55"
              opacity="0.45"
              strokeLinecap="round"
            />
          );
        })}
        {zodiac.constellation.stars.map((s, i) => (
          <g key={i}>
            {/* outer glow */}
            <circle cx={s.x} cy={s.y} r={3.2} fill="#fcd34d" opacity="0.18" />
            {/* star body */}
            <circle cx={s.x} cy={s.y} r={1.6} fill="#fde68a" opacity="0.95" />
          </g>
        ))}
      </g>
    </svg>
  );
}
