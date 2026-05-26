import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getImprintAnalysis, type ImprintAnalysis } from "@/lib/imprint";
import { getNoveltyIndex, type NoveltyIndex } from "@/lib/novelty";
import { getLocale } from "@/lib/i18n-server";
import { dnaDict } from "@/lib/i18n/dna";
import { LikesDisclaimer } from "@/components/LikesDisclaimer";
import { RadarChart } from "@/components/RadarChart";
import { BirthYearInput } from "./BirthYearInput";
import { YearBackfill } from "./YearBackfill";

export async function generateMetadata() {
  const t = dnaDict(await getLocale());
  return { title: t.metaTitle };
}

export default async function DnaPage() {
  const locale = await getLocale();
  const t = dnaDict(locale);

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dna" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.loginButton}
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await requireOnboarded();
  const [imprint, novelty] = await Promise.all([
    getImprintAnalysis(userId),
    getNoveltyIndex(userId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="text-sm text-neutral-400">
          {t.pageIntroLead} <em>{t.pageIntroWhy}</em> {t.pageIntroMid}{" "}
          <em>{t.pageIntroEm}</em>
          {t.pageIntroTail}
        </p>
      </header>
      <LikesDisclaimer locale={locale} />

      <ImprintSection a={imprint} t={t} locale={locale} />
      <NoveltySection n={novelty} t={t} />

      <p className="text-[11px] leading-relaxed text-neutral-600">
        {t.citationPrefix}{" "}
        <a
          className="underline hover:text-neutral-400"
          href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1472767/full"
        >
          {t.citationFrontiers}
        </a>
        {" · "}
        {t.citationPredictionLabel}{" "}
        <a
          className="underline hover:text-neutral-400"
          href="https://www.jneurosci.org/content/39/47/9397"
        >
          {t.citationGold}
        </a>
        {" · "}
        <a
          className="underline hover:text-neutral-400"
          href="https://www.nature.com/articles/nn.2726"
        >
          {t.citationSalimpoor}
        </a>
        {" · "}
        {t.citationPersonalityLabel}{" "}
        <a
          className="underline hover:text-neutral-400"
          href="https://gosling.psy.utexas.edu/wp-content/uploads/2014/09/JPSP03musicdimensions.pdf"
        >
          {t.citationRentfrow}
        </a>
      </p>
    </main>
  );
}

/* ─────────────────────────  Pillar B — Imprint  ───────────────────────── */

function stageText(
  t: ReturnType<typeof dnaDict>,
): Record<ImprintAnalysis["stage"], { title: string; body: string }> {
  return {
    digging: { title: t.stageDiggingTitle, body: t.stageDiggingBody },
    imprint: { title: t.stageImprintTitle, body: t.stageImprintBody },
    balanced: { title: t.stageBalancedTitle, body: t.stageBalancedBody },
    unknown: { title: t.stageUnknownTitle, body: t.stageUnknownBody },
  };
}

function ImprintSection({
  a,
  t,
  locale,
}: {
  a: ImprintAnalysis;
  t: ReturnType<typeof dnaDict>;
  locale: import("@/lib/i18n").Locale;
}) {
  const STAGE_TEXT = stageText(t);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t.imprintHeading}</h2>
        <p className="mt-1 text-sm text-neutral-400">{t.imprintIntro}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-400">
          {a.birthYear ? t.birthYearLabel(a.birthYear) : t.birthYearPrompt}
        </span>
        <BirthYearInput current={a.birthYear} locale={locale} />
      </div>

      {!a.hasYearData ? (
        <div className="flex flex-col gap-2 rounded-lg bg-amber-950/40 px-3 py-3">
          <p className="text-sm text-amber-200">{t.noYearDataWarning}</p>
          <YearBackfill missing locale={locale} />
        </div>
      ) : (
        <>
          <YearHistogram a={a} t={t} />
          <p className="text-[11px] text-neutral-500">
            {t.yearCoverage(a.totalWithYear.toLocaleString())}
            {Math.round(a.coverage * 100)}
            {t.yearCoveragePctSuffix}
            {a.coverage < 0.7 && t.yearCoverageLowNote}
          </p>
          <YearBackfill missing={false} locale={locale} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={t.statImprintShare}
              value={`${Math.round(a.imprintShare * 100)}%`}
              sub={
                a.window
                  ? t.statImprintShareSub(a.window.start, a.window.end)
                  : t.statImprintShareNoYear
              }
            />
            <Stat
              label={t.statRecent}
              value={`${Math.round(a.recentShare * 100)}%`}
              sub={t.statRecentSub}
            />
            <Stat
              label={t.statCentroid}
              value={a.medianYear ? t.statCentroidYear(a.medianYear) : t.emDash}
              sub={
                a.medianAge != null
                  ? t.statCentroidSub(a.medianAge)
                  : t.statCentroidSubFallback
              }
            />
            <Stat
              label={t.statPeak}
              value={a.peakYear ? t.statPeakYear(a.peakYear) : t.emDash}
              sub={t.statPeakSub(a.totalWithYear.toLocaleString())}
            />
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-4">
            <p className="text-sm font-semibold text-emerald-300">
              {STAGE_TEXT[a.stage].title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-300">
              {STAGE_TEXT[a.stage].body}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/** Year-by-year bar chart with the 15–25 imprint window highlighted. */
function YearHistogram({
  a,
  t,
}: {
  a: ImprintAnalysis;
  t: ReturnType<typeof dnaDict>;
}) {
  const bars = a.histogram;
  if (bars.length === 0) return null;
  const first = bars[0].year;
  const last = bars[bars.length - 1].year;
  const counts = new Map(bars.map((b) => [b.year, b.count]));
  const max = Math.max(...bars.map((b) => b.count), 1);

  // Fill every calendar year so the time axis is uniform.
  const years: { year: number; count: number; inWindow: boolean }[] = [];
  for (let y = first; y <= last; y++) {
    years.push({
      year: y,
      count: counts.get(y) ?? 0,
      inWindow: a.window != null && y >= a.window.start && y <= a.window.end,
    });
  }
  const ticks = years.filter((y) => y.year % 10 === 0);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-44 items-end gap-[2px]">
        {years.map((y) => (
          <div
            key={y.year}
            className="group relative flex h-full flex-1 items-end"
            style={{ minWidth: 2 }}
          >
            <div
              className={`w-full rounded-sm ${
                y.inWindow ? "bg-emerald-400" : "bg-white/20"
              } group-hover:bg-emerald-300`}
              style={{ height: `${Math.max(y.count > 0 ? 3 : 0, (y.count / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[11px] text-white group-hover:block">
              {y.year} · {t.histTooltipUnit(y.count)}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-4 text-[10px] text-neutral-600">
        {ticks.map((t2) => (
          <span
            key={t2.year}
            className="absolute -translate-x-1/2"
            style={{ left: `${((t2.year - first) / Math.max(1, last - first)) * 100}%` }}
          >
            {t2.year}
          </span>
        ))}
      </div>
      {a.window && (
        <p className="text-[11px] text-emerald-300/80">
          {t.histLegend(a.window.start, a.window.end)}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────  Pillar A — Novelty index  ────────────────────── */

function NoveltySection({
  n,
  t,
}: {
  n: NoveltyIndex;
  t: ReturnType<typeof dnaDict>;
}) {
  const pct = (v: number) => Math.round(v * 100);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t.noveltyHeading}</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {t.noveltyIntroLead} <em>{t.noveltyIntroEm}</em>
          {t.noveltyIntroTail}
        </p>
      </div>

      {/* familiarity ↔ novelty position */}
      <div className="flex flex-col gap-1">
        <div className="relative h-9 rounded-lg bg-gradient-to-r from-sky-500/20 via-emerald-500/30 to-fuchsia-500/20">
          {/* sweet-spot zone 0.34–0.62 */}
          <div
            className="absolute inset-y-0 border-x border-emerald-400/40 bg-emerald-400/10"
            style={{ left: "34%", width: "28%" }}
          />
          <div
            className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow"
            style={{ left: `${Math.min(98, Math.max(2, pct(n.noveltyScore)))}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-neutral-500">
          <span>{t.noveltyAxisFamiliar}</span>
          <span className="text-emerald-400">{t.noveltyAxisSweet}</span>
          <span>{t.noveltyAxisNovel}</span>
        </div>
      </div>

      {/* Radar + hint legend — the radar shows the shape of the listener's
          novelty profile at a glance; the legend below decodes each axis. */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-5">
        <RadarChart
          axes={n.components.map((c) => ({
            label: c.label,
            value: c.value,
          }))}
          size={260}
          className="h-56 w-56 shrink-0 sm:h-64 sm:w-64"
        />
        <ul className="flex w-full flex-col gap-2 text-[11px] leading-snug text-neutral-500 sm:text-xs">
          {n.components.map((c) => (
            <li key={c.key}>
              <span className="font-semibold text-neutral-200">{c.label}</span>{" "}
              <span className="tabular-nums text-emerald-300">
                {pct(c.value)}
              </span>
              <p className="text-neutral-500">{c.hint}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm leading-relaxed text-neutral-200">{n.verdict}</p>
        {n.topGenre && (
          <p className="mt-2 text-xs text-neutral-500">
            {t.noveltyTopGenre(
              n.topGenre.name,
              Math.round(n.topGenre.share * 100),
              n.distinctGenres,
              n.analyzed.toLocaleString(),
            )}
          </p>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────  shared  ─────────────────────────────── */

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
      <div className="text-[11px] text-neutral-600">{sub}</div>
    </div>
  );
}
