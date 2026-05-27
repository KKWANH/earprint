import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { WORLDCUP_SIZES, type WorldcupCategory } from "@/lib/worldcup";
import { InProgressCard } from "./InProgressCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = worldcupDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * Category + size picker. The actual bracket runs at
 * /worldcup/[cat]/[size] — keeping the picker separate makes it easy to
 * deep-link a friend to e.g. /worldcup/liked/64 ("rank your library").
 */
export default async function WorldcupHome() {
  const locale = await getLocale();
  const t = worldcupDict(locale);

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/worldcup" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            Sign in
          </button>
        </form>
      </main>
    );
  }
  const { userId } = await requireOnboarded();

  // How many candidates each category has, so the size buttons can grey
  // out anything that would fail with "not enough songs".
  const sql = getSql();
  const [lib, rec, gen] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}`,
    sql`SELECT count(*)::int AS n FROM recommendations WHERE user_id = ${userId}`,
    // Genre count = distinct genre keys present in this user's analysed
    // tracks. Some users will only have ~5 genres at first; the
    // category card greys 16강+ until enough land in their library.
    sql`
      SELECT count(DISTINCT k.key)::int AS n
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL`,
  ]);
  const libN = lib[0].n as number;
  // `forgotten` draws from the older half of the library, so it
  // effectively halves the available pool — gate it at 2× the smallest
  // bracket so the picker doesn't offer something that will return
  // fewer cards than required.
  const counts: Record<Exclude<WorldcupCategory, "liked">, number> = {
    library:   libN,
    recent:    libN,
    forgotten: Math.floor(libN / 2),
    discover:  rec[0].n as number,
    mix:       libN + (rec[0].n as number),
    genre:     gen[0].n as number,
  };

  // Order: self-bracket modes first (the product purpose), then
  // discovery-style modes. `library` is the headline default and is
  // listed top-left so a first-time visitor lands on it.
  const categories: {
    id: Exclude<WorldcupCategory, "liked">;
    emoji: string;
    label: string;
    hint: string;
    disabled: boolean;
  }[] = [
    { id: "library",   emoji: "🎲", label: t.catLibraryLabel,   hint: t.catLibraryHint,   disabled: counts.library < 4 },
    { id: "recent",    emoji: "⚡", label: t.catRecentLabel,    hint: t.catRecentHint,    disabled: counts.recent < 4 },
    { id: "forgotten", emoji: "🕰", label: t.catForgottenLabel, hint: t.catForgottenHint, disabled: counts.forgotten < 4 },
    // Genre tournaments need ≥4 distinct genres (smallest bracket size).
    // Big libraries comfortably clear 16-32; very narrow taste might not.
    { id: "genre",     emoji: "🎼", label: t.catGenreLabel,     hint: t.catGenreHint,     disabled: counts.genre < 4 },
    { id: "discover",  emoji: "🧭", label: t.catDiscoverLabel,  hint: t.catDiscoverHint,  disabled: counts.discover < 4 },
    { id: "mix",       emoji: "🔀", label: t.catMixLabel,       hint: t.catMixHint,       disabled: counts.mix < 4 },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.pageTitle}</h1>
          <p className="mt-2 text-sm text-neutral-400">{t.pageIntro}</p>
        </div>
        <Link
          href="/worldcup/community"
          className="shrink-0 rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
        >
          {locale === "ko" ? "커뮤니티" : "Community"}
        </Link>
      </header>

      {/* "Continue where you left off" — scans localStorage for any
          saved-in-progress brackets and surfaces them as amber resume
          cards. Renders nothing when there's nothing saved. */}
      <InProgressCard
        labels={{
          title: t.inProgressTitle,
          resume: t.inProgressResume,
          dismiss: t.inProgressDismiss,
          roundLabel: t.inProgressRoundLabel,
          pairLabel: t.inProgressPairLabel,
          catLabels: {
            library: t.catLibraryLabel,
            recent: t.catRecentLabel,
            forgotten: t.catForgottenLabel,
            genre: t.catGenreLabel,
            discover: t.catDiscoverLabel,
            mix: t.catMixLabel,
            liked: t.catLikedLabel,
          },
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t.categoryTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <CategoryCard
              key={c.id}
              cat={c}
              counts={counts}
              locale={locale}
              comingSoonText={t.catComingSoon}
              sizeTitle={t.sizeTitle}
              startText={t.sizeStart}
              roundCount={t.sizeRoundCount}
              notEnoughFn={t.notEnough}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function CategoryCard({
  cat,
  counts,
  comingSoonText,
  sizeTitle,
  startText,
  roundCount,
  notEnoughFn,
}: {
  cat: {
    id: Exclude<WorldcupCategory, "liked">;
    emoji: string;
    label: string;
    hint: string;
    disabled: boolean;
  };
  counts: Record<Exclude<WorldcupCategory, "liked">, number>;
  locale: string;
  comingSoonText: string;
  sizeTitle: string;
  startText: string;
  roundCount: (n: number) => string;
  notEnoughFn: (have: number, need: number) => string;
}) {
  const have = counts[cat.id];
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-5 transition-colors ${
        cat.disabled
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : "border-white/10 bg-white/[0.04] hover:border-emerald-500/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{cat.emoji}</span>
        <div className="flex-1">
          <p className="font-semibold">{cat.label}</p>
          <p className="text-xs text-neutral-500">{cat.hint}</p>
        </div>
        {/* "Coming soon" badge intentionally removed — genre category
            now ships fully. Left the prop in place in case we add other
            future-only categories later. */}
        {false && cat.id === "genre" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
            {comingSoonText}
          </span>
        )}
      </div>

      {!cat.disabled && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">
            {sizeTitle}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WORLDCUP_SIZES.map((s) => {
              const enough = have >= s;
              return enough ? (
                <Link
                  key={s}
                  href={`/worldcup/${cat.id}/${s}`}
                  className="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  {s}강
                </Link>
              ) : (
                <span
                  key={s}
                  title={notEnoughFn(have, s)}
                  className="rounded-md border border-white/5 bg-black/10 px-3 py-1.5 text-sm text-neutral-600"
                >
                  {s}강
                </span>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-600">
            {startText} · {roundCount(Math.log2(Math.min(have, 128)))}
          </p>
        </div>
      )}
    </div>
  );
}
