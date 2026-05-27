import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { WORLDCUP_SIZES, type WorldcupCategory } from "@/lib/worldcup";

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
  const counts: Record<WorldcupCategory, number> = {
    liked: lib[0].n as number,
    discover: rec[0].n as number,
    mix: (lib[0].n as number) + (rec[0].n as number),
    genre: gen[0].n as number,
  };

  const categories: {
    id: WorldcupCategory;
    emoji: string;
    label: string;
    hint: string;
    disabled: boolean;
  }[] = [
    { id: "liked",    emoji: "❤️", label: t.catLikedLabel,    hint: t.catLikedHint,    disabled: counts.liked < 4 },
    { id: "discover", emoji: "🧭", label: t.catDiscoverLabel, hint: t.catDiscoverHint, disabled: counts.discover < 4 },
    { id: "mix",      emoji: "🔀", label: t.catMixLabel,      hint: t.catMixHint,      disabled: counts.mix < 4 },
    // Genre tournaments need ≥4 distinct genres (smallest bracket size).
    // Big libraries comfortably clear 16-32; very narrow taste might not.
    { id: "genre",    emoji: "🎼", label: t.catGenreLabel,    hint: t.catGenreHint,    disabled: counts.genre < 4 },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">{t.pageTitle}</h1>
        <p className="mt-2 text-sm text-neutral-400">{t.pageIntro}</p>
      </header>

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
    id: WorldcupCategory;
    emoji: string;
    label: string;
    hint: string;
    disabled: boolean;
  };
  counts: Record<WorldcupCategory, number>;
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
