import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "@/auth";
import { MusicZodiacCard } from "@/components/MusicZodiacCard";
import { getLocale } from "@/lib/i18n-server";
import { demoDict } from "@/lib/i18n/demo";
import { getMusicZodiac } from "@/lib/musicZodiac";
import { SAMPLE_PROFILE, SAMPLE_STATS } from "@/lib/sampleData";

export async function generateMetadata(): Promise<Metadata> {
  const t = demoDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * Public sample dashboard — what a finished Earprint analysis looks like,
 * rendered from hand-crafted fake data. The point is to let visitors see
 * the goods before they have to sign in + install the extension. The
 * Music Zodiac runs through the real getMusicZodiac() so the visual
 * matches what users actually get.
 */
export default async function DemoPage() {
  const locale = await getLocale();
  const t = demoDict(locale);
  const zodiac = getMusicZodiac(SAMPLE_STATS);
  const profile = SAMPLE_PROFILE;
  const stats = SAMPLE_STATS;
  const feel = stats.audioFeel!;
  const lang = locale === "ko" ? "ko-KR" : "en-US";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-12">
      {/* Sample banner — always visible at the top so no one mistakes the
          data for their own. */}
      <aside className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm sm:flex-row sm:items-center sm:gap-4">
        <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
          {t.bannerLabel}
        </span>
        <p className="flex-1 text-amber-100/85">{t.bannerBody}</p>
      </aside>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
      </header>

      {zodiac && <MusicZodiacCard data={zodiac} locale={locale} />}

      {/* Library stats grid */}
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
        <h2 className="font-semibold">{t.statsTitle}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.statSongs} value={stats.total.toLocaleString(lang)} />
          <Stat
            label={t.statArtists}
            value={stats.distinctArtists.toLocaleString(lang)}
          />
          <Stat label={t.statGenres} value={stats.topGenres[0]!.name} />
          <Stat
            label={t.statAlbumDepth}
            value={`${Math.round(stats.albumDepth.concentration * 100)}%`}
          />
        </div>
      </section>

      {/* Top artists / genres / moods — three small bar cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SampleBars
          title={t.topArtistsTitle}
          items={stats.topArtists.slice(0, 5)}
          color="bg-amber-500"
        />
        <SampleBars
          title={t.genresTitle}
          items={stats.topGenres.slice(0, 5)}
          color="bg-indigo-500"
        />
        <SampleBars
          title={t.moodsTitle}
          items={stats.topMoods.slice(0, 5)}
          color="bg-rose-500"
        />
      </div>

      {/* Audio feel — same axis style as /library */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
        <h2 className="font-semibold">{t.audioTitle}</h2>
        {[
          { label: t.feelEnergy, v: feel.energy },
          { label: t.feelTempo, v: feel.tempo },
          { label: t.feelAcoustic, v: feel.acousticness },
        ].map((a) => (
          <div key={a.label} className="flex items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-neutral-400">{a.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-sky-400"
                style={{ width: `${Math.round(a.v * 100)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs text-neutral-500">
              {Math.round(a.v * 100)}
            </span>
          </div>
        ))}
      </section>

      {/* AI profile excerpt */}
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
        <h2 className="font-semibold">{t.profileTitle}</h2>
        <h3 className="text-xl font-bold text-indigo-300">{profile.headline}</h3>
        <p className="text-sm leading-relaxed text-neutral-300">
          {profile.personality}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {profile.traits.map((tr) => (
            <span
              key={tr}
              className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs"
            >
              {tr}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-white/5 pt-4">
          <div className="flex flex-col items-center">
            <div className="text-3xl font-bold text-emerald-400">
              {profile.diggingScore}
            </div>
            <div className="text-[11px] text-neutral-500">{t.diggingScore}</div>
          </div>
          <p className="flex-1 text-sm leading-relaxed text-neutral-300">
            {profile.diggingComment}
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 p-6 text-center sm:p-8">
        <h2 className="text-xl font-bold sm:text-2xl">{t.bottomCtaTitle}</h2>
        <p className="max-w-md text-sm leading-relaxed text-neutral-400">
          {t.bottomCtaBody}
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/library" });
          }}
        >
          <button className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400">
            {t.ctaPrimary}
          </button>
        </form>
        <Link
          href="/guide"
          className="text-xs text-neutral-400 underline-offset-2 hover:text-white hover:underline"
        >
          {t.ctaSecondary}
        </Link>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 truncate text-lg font-bold capitalize sm:text-xl">
        {value}
      </div>
    </div>
  );
}

/** Tiny bar list — three small cards on the demo (top artists / genres / moods). */
function SampleBars({
  title,
  items,
  color,
}: {
  title: string;
  items: { name: string; count: number }[];
  color: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-300">{title}</h3>
      <div className="flex flex-col gap-1.5">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 truncate text-neutral-300">
              {it.name}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded bg-white/10">
              <div
                className={`h-full ${color}`}
                style={{ width: `${(it.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
