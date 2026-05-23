import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getLibraryStats, type Count, type AudioFeelAgg } from "@/lib/library";
import { AnalyzePanel } from "./AnalyzePanel";
import { PreviewButton } from "./PreviewButton";
import { ExcludeButton } from "./ExcludeButton";
import { ResendReportButton } from "./ResendReportButton";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { getLocale } from "@/lib/i18n-server";
import { libraryDict } from "@/lib/i18n/library";
import type { Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = libraryDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

export default async function LibraryPage() {
  const locale = await getLocale();
  const t = libraryDict(locale);
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/library" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.loginGoogle}
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await ensureConnection();
  const stats = await getLibraryStats(userId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
          <p className="truncate text-xs text-neutral-500">{session.user.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:text-white">
            {t.logout}
          </button>
        </form>
      </header>

      <AnalyzePanel locale={locale} />
      <ResendReportButton locale={locale} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.statLikedTracks} value={stats.total.toLocaleString()} />
        <Stat label={t.statAnalyzed} value={stats.enriched.toLocaleString()} />
        <Stat label={t.statArtists} value={stats.distinctArtists.toLocaleString()} />
        <Stat
          label={t.statAlbumDepth}
          value={`${Math.round(stats.albumDepth.concentration * 100)}%`}
        />
      </section>

      <BarCard
        title={t.topArtistsTitle}
        items={stats.topArtists}
        color="bg-amber-500"
        empty={t.topArtistsEmpty}
        excludable
        linkArtist
        locale={locale}
      />
      <BarCard
        title={t.genreTitle}
        items={stats.topGenres}
        color="bg-indigo-500"
        empty={t.genreEmpty}
        linkGenre
        footerHref="/genres"
        footerLabel={t.viewAllGenres}
        locale={locale}
      />
      <BarCard
        title={t.moodTitle}
        items={stats.topMoods}
        color="bg-rose-500"
        empty={t.moodEmpty}
        locale={locale}
      />

      {stats.audioFeel && <FeelCard feel={stats.audioFeel} t={t} />}
      <BarCard
        title={t.instrumentsTitle}
        items={stats.topInstruments}
        color="bg-sky-500"
        empty={t.instrumentsEmpty}
        locale={locale}
      />
      <BarCard
        title={`${t.albumsTitlePrefix} ${t.albumsTitleDeep(stats.albumDepth.deepAlbums)}`}
        items={stats.topAlbums}
        color="bg-fuchsia-500"
        empty={t.albumsEmpty}
        locale={locale}
      />

      {stats.excludedArtists.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="font-semibold">{t.excludedTitle(stats.excludedArtists.length)}</h2>
          <div className="flex flex-wrap gap-2">
            {stats.excludedArtists.map((a) => (
              <span
                key={a}
                className="flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-sm text-neutral-400"
              >
                {a}
                <ExcludeButton artist={a} restore locale={locale} />
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">{t.tracksTitle(stats.tracks.length)}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-500">
                <th className="py-2 pr-3 font-medium">{t.thTitle}</th>
                <th className="py-2 pr-3 font-medium">{t.thArtist}</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">{t.thGenre}</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">{t.thMood}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {stats.tracks.map((t, i) => (
                <tr key={i} className="border-b border-neutral-800/60 last:border-0">
                  <td className="max-w-[14rem] truncate py-1.5 pr-3">{t.title}</td>
                  <td className="max-w-[9rem] truncate py-1.5 pr-3 text-neutral-400">
                    <Link
                      href={`/artist/${encodeURIComponent(t.artist)}`}
                      className="hover:text-white hover:underline"
                    >
                      {t.artist}
                    </Link>
                  </td>
                  <td className="hidden max-w-[11rem] truncate py-1.5 pr-3 text-neutral-400 sm:table-cell">
                    {t.genres?.slice(0, 2).join(", ") ?? "—"}
                  </td>
                  <td className="hidden max-w-[9rem] truncate py-1.5 pr-3 text-neutral-400 sm:table-cell">
                    {t.moods?.slice(0, 2).join(", ") ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <PreviewButton deezerId={t.deezerId} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-neutral-600">{t.dataDisclaimer}</p>

      <section className="flex flex-col gap-3 rounded-xl border border-rose-900/40 bg-neutral-900 p-6">
        <div>
          <h2 className="font-semibold text-rose-300">{t.dangerZoneTitle}</h2>
          <p className="mt-1 text-sm text-neutral-400">{t.dangerZoneDesc}</p>
        </div>
        <DeleteAccountButton locale={locale} />
      </section>
    </main>
  );
}

function FeelCard({
  feel,
  t,
}: {
  feel: AudioFeelAgg;
  t: ReturnType<typeof libraryDict>;
}) {
  const axes = [
    { label: t.feelEnergy, lo: t.feelEnergyLo, hi: t.feelEnergyHi, v: feel.energy },
    { label: t.feelTempo, lo: t.feelTempoLo, hi: t.feelTempoHi, v: feel.tempo },
    { label: t.feelSound, lo: t.feelSoundLo, hi: t.feelSoundHi, v: feel.acousticness },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">
        {t.feelTitle}{" "}
        <span className="text-xs font-normal text-neutral-500">
          {t.feelAverage(feel.analyzed.toLocaleString())}
        </span>
      </h2>
      <div className="flex flex-col gap-3">
        {axes.map((a) => (
          <div key={a.label} className="flex items-center gap-3 text-sm">
            <span className="w-12 shrink-0 text-neutral-300">{a.label}</span>
            <span className="w-12 shrink-0 text-right text-xs text-neutral-600">{a.lo}</span>
            <div className="relative h-2 flex-1 rounded-full bg-neutral-800">
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-sky-400"
                style={{ left: `calc(${Math.round(a.v * 100)}% - 7px)` }}
              />
            </div>
            <span className="w-12 shrink-0 text-xs text-neutral-600">{a.hi}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function BarCard({
  title,
  items,
  color,
  empty,
  excludable,
  linkArtist,
  linkGenre,
  footerHref,
  footerLabel,
  locale,
}: {
  title: string;
  items: Count[];
  color: string;
  empty: string;
  excludable?: boolean;
  linkArtist?: boolean;
  linkGenre?: boolean;
  footerHref?: string;
  footerLabel?: string;
  locale: Locale;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const hrefFor = (n: string) =>
    linkArtist
      ? `/artist/${encodeURIComponent(n)}`
      : linkGenre
        ? `/genre/${encodeURIComponent(n)}`
        : null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => {
            const href = hrefFor(it.name);
            return (
            <div key={it.name} className="flex items-center gap-3 text-sm">
              {href ? (
                <Link
                  href={href}
                  className="w-32 shrink-0 truncate text-neutral-300 hover:text-white hover:underline"
                >
                  {it.name}
                </Link>
              ) : (
                <span className="w-32 shrink-0 truncate text-neutral-300">{it.name}</span>
              )}
              <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-800">
                <div
                  className={`h-full ${color}`}
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-neutral-500">{it.count}</span>
              {excludable && <ExcludeButton artist={it.name} locale={locale} />}
            </div>
            );
          })}
        </div>
      )}
      {footerHref && footerLabel && items.length > 0 && (
        <Link
          href={footerHref}
          className="self-end text-xs text-neutral-400 hover:text-white"
        >
          {footerLabel}
        </Link>
      )}
    </section>
  );
}
