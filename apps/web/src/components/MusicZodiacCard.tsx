"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";
import { ALL_ZODIACS, type MusicZodiac, type Zodiac } from "@/lib/musicZodiac";

/** Twinkly background stars — deterministic positions so they don't flicker. */
const BG_STARS = Array.from({ length: 70 }, (_, i) => {
  const sx = (i * 9301 + 49297) % 233280;
  const sy = ((i + 1) * 14013 + 27179) % 233280;
  const sr = ((i + 1) * 7919) % 233280;
  return {
    x: (sx / 233280) * 100,
    y: (sy / 233280) * 60,
    r: 0.18 + (sr / 233280) * 0.6,
    o: 0.25 + ((i * 13) % 7) * 0.08,
  };
});

// VS15 forces text-style presentation of the zodiac symbol so it renders as
// a glyph rather than the platform's emoji image.
const TEXT_STYLE = "︎";

/** The user's zodiac as a cosmic scene; the twelve-sign strip is browsable. */
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
          {isMatched && data.matched.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-white/45">
                {t.zodiacMatched}
              </span>
              {data.matched.slice(0, 6).map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ALL_ZODIACS.map((other) => {
          const isMatch = other.sign === matchedSign;
          const isActive = other.sign === active.sign;
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
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Star field + the active sign's actual constellation lines. */
function CosmicBackground({ zodiac }: { zodiac: Zodiac }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {BG_STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}
      <g transform="translate(32 12) scale(0.36)" opacity="0.6">
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
              strokeWidth="0.45"
              opacity="0.45"
            />
          );
        })}
        {zodiac.constellation.stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={1.4} fill="#fcd34d" opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}
