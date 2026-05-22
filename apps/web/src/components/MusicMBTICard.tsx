import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";
import type { MusicMBTI } from "@/lib/musicMBTI";

/** A four-axis MBTI-style card. Comparable across users, easy to share. */
export function MusicMBTICard({
  mbti,
  locale,
}: {
  mbti: MusicMBTI;
  locale: Locale;
}) {
  const t = profileDict(locale);
  const axes = [
    { left: t.mbtiAxisMainstream, right: t.mbtiAxisNiche, ...mbti.axes.mainstream },
    { left: t.mbtiAxisAcoustic, right: t.mbtiAxisElectronic, ...mbti.axes.acoustic },
    { left: t.mbtiAxisCalm, right: t.mbtiAxisVigorous, ...mbti.axes.calm },
    { left: t.mbtiAxisFamiliar, right: t.mbtiAxisExploratory, ...mbti.axes.familiar },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-900 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {t.mbtiHeading}
        </h2>
        <span className="font-mono text-3xl font-extrabold tracking-[0.18em] text-emerald-300 sm:text-4xl">
          {mbti.code}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {axes.map((a, i) => {
          // value is the strength of the LEFT trait (0..1), so a high value
          // means the dot sits near the left edge of the track.
          const dotLeft = `${Math.min(96, Math.max(4, (1 - a.value) * 100))}%`;
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-neutral-400">{a.left}</span>
                <div className="relative h-1.5 flex-1 rounded-full bg-white/10">
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30"
                    style={{ left: dotLeft }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-neutral-400">
                  {a.right}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
