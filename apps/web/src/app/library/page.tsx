import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import {
  getLibraryStats,
  getLibraryTracks,
  type AlbumDepth,
  type AudioFeelAgg,
  type Count,
} from "@/lib/library";
import { AnalyzePanel } from "./AnalyzePanel";
import { PreviewButton } from "./PreviewButton";
import { ExcludeButton } from "./ExcludeButton";
import { ShareButton } from "../profile/ShareButton";
import { getLocale } from "@/lib/i18n-server";
import { libraryDict } from "@/lib/i18n/library";
import { profileDict } from "@/lib/i18n/profile";
import type { Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = libraryDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
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

  const { userId } = await requireOnboarded();
  const sql = getSql();
  // Search + page come from URL — the form below uses method=GET so a
  // bookmarked / shared URL keeps the user on the same page of the same
  // query. Parse defensively (empty string → undefined, NaN page → 1).
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const pageNum = Math.max(1, Number(sp.page) || 1);
  // Share id is created lazily when /api/profile lands; here we only
  // surface the share UI when one already exists, so the user doesn't
  // see a "share my analysis" button before they've actually run an
  // analysis. Cheap one-column SELECT.
  const [stats, tracksPage, shareRow] = await Promise.all([
    getLibraryStats(userId),
    getLibraryTracks(userId, { q, page: pageNum, pageSize: 50 }),
    sql`SELECT share_id FROM taste_profiles WHERE user_id = ${userId}`,
  ]);
  const shareId = (shareRow[0]?.share_id as string | undefined) ?? null;
  const totalPages = Math.max(1, Math.ceil(tracksPage.total / tracksPage.pageSize));
  const pt = profileDict(locale);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="truncate text-xs text-neutral-500">{session.user.email}</p>
      </header>

      <AnalyzePanel locale={locale} />

      {shareId && (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-900/50 bg-neutral-900 p-6">
          <h2 className="font-semibold text-emerald-300">{pt.shareHeading}</h2>
          <p className="text-xs text-neutral-400">{pt.shareCtaLine}</p>
          <ShareButton shareId={shareId} locale={locale} />
        </section>
      )}

      <ConfidenceRollup
        total={stats.total}
        enriched={stats.enriched}
        t={t}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.statLikedTracks} value={stats.total.toLocaleString()} />
        <Stat label={t.statAnalyzed} value={stats.enriched.toLocaleString()} />
        <Stat label={t.statArtists} value={stats.distinctArtists.toLocaleString()} />
        <Stat
          label={t.statAlbumDepth}
          value={`${Math.round(stats.albumDepth.concentration * 100)}%`}
        />
      </section>
      <AlbumImmersionLine
        depth={stats.albumDepth}
        t={t}
      />

      {/* Per-card denominators chosen for what's most intuitive:
          - artists / moods / instruments / albums: % of total liked songs
          - genres: % of analyzed tracks (genres are only tagged on tracks
            that completed Phase 2 of analysis; against total it would
            understate genre weight for partially-analyzed libraries)
          - recentArtists: % of the recent-window slice that powers it
            (stat.total would lie since "recent" is a smaller cohort) */}
      <BarCard
        title={t.topArtistsTitle}
        items={stats.topArtists}
        color="bg-amber-500"
        empty={t.topArtistsEmpty}
        excludable
        linkArtist
        pctOf={stats.total}
        locale={locale}
      />
      {stats.recentArtists.length > 0 && (
        <BarCard
          title={t.recentArtistsTitle}
          items={stats.recentArtists}
          color="bg-emerald-500"
          empty={t.topArtistsEmpty}
          linkArtist
          highlightAgainst={new Set(
            stats.topArtists.map((a) => a.name.toLowerCase()),
          )}
          pctOf={stats.recentArtists.reduce((s, a) => s + a.count, 0)}
          locale={locale}
        />
      )}
      <BarCard
        title={t.genreTitle}
        items={stats.topGenres}
        color="bg-indigo-500"
        empty={t.genreEmpty}
        linkGenre
        footerHref="/genres"
        footerLabel={t.viewAllGenres}
        pctOf={stats.enriched}
        locale={locale}
      />
      <BarCard
        title={t.moodTitle}
        items={stats.topMoods}
        color="bg-rose-500"
        empty={t.moodEmpty}
        pctOf={stats.enriched}
        locale={locale}
      />

      {stats.audioFeel && <FeelCard feel={stats.audioFeel} t={t} />}
      <BarCard
        title={t.instrumentsTitle}
        items={stats.topInstruments}
        color="bg-sky-500"
        empty={t.instrumentsEmpty}
        pctOf={stats.enriched}
        locale={locale}
      />
      <BarCard
        title={`${t.albumsTitlePrefix} ${t.albumsTitleDeep(stats.albumDepth.deepAlbums)}`}
        items={stats.topAlbums}
        color="bg-fuchsia-500"
        empty={t.albumsEmpty}
        pctOf={stats.total}
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
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-semibold">{t.tracksTitle(tracksPage.total)}</h2>
          <p className="text-xs text-neutral-500">
            {t.searchResultCount(tracksPage.tracks.length, tracksPage.total)}
          </p>
        </div>
        {/* GET form so the URL is shareable + reload-safe. Resets to page=1
            implicitly because the form doesn't carry `page` over. */}
        <form
          method="GET"
          action="/library"
          className="flex items-center gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
          />
          {q && (
            <Link
              href="/library"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              {t.searchClear}
            </Link>
          )}
        </form>
        <div className="overflow-x-auto">
          {tracksPage.tracks.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              {t.searchNoMatch}
            </p>
          ) : (
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
                {tracksPage.tracks.map((tr, i) => (
                  <tr key={i} className="border-b border-neutral-800/60 last:border-0">
                    <td className="max-w-[14rem] truncate py-1.5 pr-3">{tr.title}</td>
                    <td className="max-w-[9rem] truncate py-1.5 pr-3 text-neutral-400">
                      <Link
                        href={`/artist/${encodeURIComponent(tr.artist)}`}
                        className="hover:text-white hover:underline"
                      >
                        {tr.artist}
                      </Link>
                    </td>
                    <td className="hidden max-w-[11rem] truncate py-1.5 pr-3 text-neutral-400 sm:table-cell">
                      {tr.genres?.slice(0, 2).join(", ") ?? "—"}
                    </td>
                    <td className="hidden max-w-[9rem] truncate py-1.5 pr-3 text-neutral-400 sm:table-cell">
                      {tr.moods?.slice(0, 2).join(", ") ?? "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      <PreviewButton deezerId={tr.deezerId} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Pagination — hidden on single-page results. Links carry the
            current q so the user stays inside their search while flipping
            pages. */}
        {totalPages > 1 && (
          <Pagination
            page={pageNum}
            totalPages={totalPages}
            q={q}
            labels={{ prev: t.pagePrev, next: t.pageNext, of: t.pageOf }}
          />
        )}
      </section>

      <p className="text-xs leading-relaxed text-neutral-600">{t.dataDisclaimer}</p>
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
  // Per-axis tier thresholds at 0.4 / 0.7 — gives a natural split into
  // low / mid / high without the boundary feeling arbitrary. The
  // accompanying read () is the one-liner the user actually walks away
  // remembering, since the bar position alone doesn't say "is 0.55
  // low or mid for this axis?".
  const tier = (v: number) => (v < 0.4 ? "low" : v < 0.7 ? "mid" : "high");
  const axes = [
    {
      label: t.feelEnergy,
      lo: t.feelEnergyLo,
      hi: t.feelEnergyHi,
      v: feel.energy,
      read: {
        low: t.feelEnergyLow,
        mid: t.feelEnergyMid,
        high: t.feelEnergyHigh,
      }[tier(feel.energy)],
    },
    {
      label: t.feelTempo,
      lo: t.feelTempoLo,
      hi: t.feelTempoHi,
      v: feel.tempo,
      read: {
        low: t.feelTempoLow,
        mid: t.feelTempoMid,
        high: t.feelTempoHigh,
      }[tier(feel.tempo)],
    },
    {
      label: t.feelSound,
      lo: t.feelSoundLo,
      hi: t.feelSoundHi,
      v: feel.acousticness,
      read: {
        low: t.feelAcousticLow,
        mid: t.feelAcousticMid,
        high: t.feelAcousticHigh,
      }[tier(feel.acousticness)],
    },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">
        {t.feelTitle}{" "}
        <span className="text-xs font-normal text-neutral-500">
          {t.feelAverage(feel.analyzed.toLocaleString())}
        </span>
      </h2>
      <div className="flex flex-col gap-4">
        {axes.map((a) => (
          <div key={a.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-3 text-sm">
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
            <p className="ml-[3.75rem] text-[11px] leading-snug text-neutral-500">
              {a.read}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Tells the user at a glance how much of their library has gone through
 * Phase 2 (Gemini-inferred genres/moods) — the figure under every other
 * card. Without this, a 1,500-track library that's only 200-tracks-deep
 * into analysis still looks "rich" because the bar charts render fully;
 * the user thinks they're seeing their full taste when half of it isn't
 * tagged yet.
 *
 * Buckets (coverage = enriched / total):
 *   ≥ 95% → high     · the dashboards reflect almost everything
 *   ≥ 70% → medium   · meaningful, but a few popular tags may be under-counted
 *   <  70% → low     · noticeable gaps — Run Analyze to fill in
 *   total == 0     → building · no tracks synced yet
 */
function ConfidenceRollup({
  total,
  enriched,
  t,
}: {
  total: number;
  enriched: number;
  t: ReturnType<typeof libraryDict>;
}) {
  if (total === 0) {
    return (
      <p className="rounded-md border border-neutral-700 bg-neutral-800/40 px-3 py-1.5 text-xs text-neutral-400">
        {t.confidenceLabel}: <span className="font-medium">{t.confidenceBuilding}</span>
      </p>
    );
  }
  const pct = Math.round((enriched / total) * 100);
  const bucket =
    pct >= 95 ? "high" : pct >= 70 ? "medium" : "low";
  const label =
    bucket === "high"
      ? t.confidenceHigh
      : bucket === "medium"
        ? t.confidenceMedium
        : t.confidenceLow;
  const tone =
    bucket === "high"
      ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
      : bucket === "medium"
        ? "border-amber-500/30 bg-amber-950/30 text-amber-200"
        : "border-rose-500/30 bg-rose-950/30 text-rose-200";
  return (
    <p className={`rounded-md border px-3 py-1.5 text-xs ${tone}`}>
      {t.confidenceLabel}: <span className="font-semibold">{label}</span>
      <span className="ml-1 text-current/70">
        — {t.confidenceSummary(total.toLocaleString(), enriched.toLocaleString(), pct)}
      </span>
    </p>
  );
}

/** Plain-language read of the Album immersion %. Anchors the otherwise
 *  abstract number to listener behaviour — see i18n notes for thresholds. */
function AlbumImmersionLine({
  depth,
  t,
}: {
  depth: AlbumDepth;
  t: ReturnType<typeof libraryDict>;
}) {
  if (depth.deepAlbums === 0 && depth.concentration === 0) return null;
  const c = depth.concentration;
  const line =
    c < 0.15
      ? t.albumImmersionSingles
      : c < 0.35
        ? t.albumImmersionMixed
        : t.albumImmersionDeep(depth.deepAlbums);
  return (
    <p className="text-xs leading-relaxed text-neutral-500">{line}</p>
  );
}

/**
 * Pagination footer for the tracks table. Kept dumb — Prev / page indicator
 * / Next, no jump-to-page input. With pageSize=50, even a 5k-track library
 * is 100 pages, which is a reasonable Next-button workout — anyone wanting
 * to scan past that should use search instead.
 */
function Pagination({
  page,
  totalPages,
  q,
  labels,
}: {
  page: number;
  totalPages: number;
  q: string;
  labels: {
    prev: string;
    next: string;
    of: (cur: number, total: number) => string;
  };
}) {
  const href = (p: number) => {
    const qp = new URLSearchParams();
    if (q) qp.set("q", q);
    if (p > 1) qp.set("page", String(p));
    const s = qp.toString();
    return s ? `/library?${s}` : "/library";
  };
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <nav className="flex items-center justify-between gap-2 pt-2 text-xs text-neutral-500">
      {hasPrev ? (
        <Link
          href={href(page - 1)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 hover:text-white"
        >
          {labels.prev}
        </Link>
      ) : (
        <span className="rounded-md border border-neutral-800 px-3 py-1.5 text-neutral-700">
          {labels.prev}
        </span>
      )}
      <span className="tabular-nums">{labels.of(page, totalPages)}</span>
      {hasNext ? (
        <Link
          href={href(page + 1)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 hover:text-white"
        >
          {labels.next}
        </Link>
      ) : (
        <span className="rounded-md border border-neutral-800 px-3 py-1.5 text-neutral-700">
          {labels.next}
        </span>
      )}
    </nav>
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
  highlightAgainst,
  pctOf,
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
  /** When provided, items NOT present in this set (lowercased names) get
   *  a ✨ marker — used on the "recent picks" card to flag artists that
   *  weren't in the user's all-time top, i.e. genuinely new to the
   *  current rotation. Empty set means everything is "new" (no highlight). */
  highlightAgainst?: Set<string>;
  /** Denominator for the "(X%)" suffix next to each row's count. When 0 or
   *  undefined the percentage is omitted (e.g. zero-track library). The
   *  caller picks the meaningful denominator — total likes, analyzed
   *  count, or the sum of items.counts — depending on what's intuitive
   *  for the metric. See library/page.tsx for the per-card choices. */
  pctOf?: number;
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
            const isNew =
              highlightAgainst != null &&
              highlightAgainst.size > 0 &&
              !highlightAgainst.has(it.name.toLowerCase());
            // Render the ✨ inline before the name so wrapping behaves
            // naturally on long Korean artist names. Tooltip on hover.
            const display = isNew ? (
              <>
                <span title="새로 등장한 아티스트" className="mr-1">✨</span>
                {it.name}
              </>
            ) : (
              it.name
            );
            return (
            <div key={it.name} className="flex items-center gap-3 text-sm">
              {href ? (
                <Link
                  href={href}
                  className="w-24 shrink-0 truncate text-neutral-300 hover:text-white hover:underline sm:w-32"
                >
                  {display}
                </Link>
              ) : (
                <span className="w-24 shrink-0 truncate text-neutral-300 sm:w-32">{display}</span>
              )}
              <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-800">
                <div
                  className={`h-full ${color}`}
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-neutral-500">{it.count}</span>
              {/* % column rendered only when a meaningful denominator was
                  passed. Width is fixed so the bar/count columns above
                  don't reflow per-card. */}
              {pctOf && pctOf > 0 ? (
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-neutral-600">
                  {Math.round((it.count / pctOf) * 100)}%
                </span>
              ) : null}
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
