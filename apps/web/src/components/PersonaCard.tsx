import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";
import type { Persona } from "@/lib/profile";

/**
 * The shareable music-persona card — used on the psychology page, the public
 * share page and the landing-page sample gallery.
 */
export function PersonaCard({
  persona,
  score,
  percentile,
  locale,
}: {
  persona: Persona;
  score: number;
  percentile: number | null;
  locale: Locale;
}) {
  const t = profileDict(locale);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/40 via-fuchsia-600/30 to-amber-500/25 p-8 text-center">
      {/* logo watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 opacity-[0.07]"
      />
      <div className="relative flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/30 text-5xl ring-1 ring-white/15">
          {persona.emoji}
        </div>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
          {persona.archetype}
        </p>
        <h2 className="mt-1.5 text-2xl font-extrabold leading-tight sm:text-3xl">
          {persona.name}
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-white/80">
          {persona.tagline}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-1.5">
            <span className="font-bold text-emerald-300">
              {t.personaScore} {score}
            </span>
            <span className="text-white/40">/ 100</span>
          </span>
          {percentile != null && (
            <span className="rounded-full bg-black/40 px-4 py-1.5 font-bold text-amber-300">
              {t.topPercent(percentile)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
