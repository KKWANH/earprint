import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";
import type { MusicZodiac } from "@/lib/musicZodiac";

/**
 * The user's music zodiac — one of twelve signs picked deterministically
 * from their top genres and moods.
 */
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
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {t.zodiacHeading}
      </p>
      <div className="text-6xl leading-none text-amber-300">{z.symbol}</div>
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">{name}</p>
        <h2 className="mt-1 text-2xl font-extrabold leading-tight">{archetype}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-300">{blurb}</p>
      </div>
      {data.matched.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 border-t border-white/10 pt-3">
          <span className="text-xs text-neutral-500">{t.zodiacMatched}</span>
          {data.matched.slice(0, 8).map((m) => (
            <span
              key={m}
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
