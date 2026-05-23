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
    r: 0.18 + ((sr / 233280) * 0.6),
    o: 0.25 + ((i * 13) % 7) * 0.08,
  };
});

/** The matched user's zodiac, with cosmic background and the twelve-sign strip. */
export function MusicZodiacCard({
  data,
  locale,
}: {
  data: MusicZodiac;
  locale: Locale;
}) {
  const t = profileDict(locale);
  const z = data.zodiac;
  const name = locale === "ko" ? z.nameKo : z.nameEn;
  const archetype = locale === "ko" ? z.archetypeKo : z.archetypeEn;
  const blurb = locale === "ko" ? z.blurbKo : z.blurbEn;

  return (
    <section className="flex flex-col gap-3">
      {/* Featured zodiac */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 px-6 py-8 text-center"
        style={{
          background:
            "radial-gradient(ellipse at top, #1e1b4b 0%, #0a0a0b 55%, #1c0a2e 100%)",
        }}
      >
        <CosmicBackground zodiac={z} />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {t.zodiacHeading}
          </p>
          <div className="mt-3 text-7xl leading-none text-amber-300 drop-shadow-[0_0_24px_rgba(252,211,77,0.4)]">
            {z.symbol}
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
          {data.matched.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center items-center gap-1.5">
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

      {/* All twelve signs — user's pick highlighted */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ALL_ZODIACS.map((other) => {
          const active = other.sign === z.sign;
          return (
            <div
              key={other.sign}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors ${
                active
                  ? "border-amber-400/50 bg-amber-500/10 ring-1 ring-amber-400/30"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <span
                className={`text-xl leading-none ${active ? "text-amber-300" : "text-neutral-600"}`}
              >
                {other.symbol}
              </span>
              <span
                className={`text-[10px] ${active ? "text-amber-200" : "text-neutral-500"}`}
              >
                {locale === "ko" ? other.nameKo : other.nameEn}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Star field + the matched sign's actual constellation lines. */
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
      {/* Constellation overlay — centred, occupying x:32..68, y:12..48 */}
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
