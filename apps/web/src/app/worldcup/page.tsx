import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";

// auth() reads request cookies (NextAuth session) so the page can't
// be statically prerendered. Force-dynamic also covers the
// loadCommunityHomeData() + loadMyWorldcups() SQL paths that hit
// per-user state. R32a — was breaking next build with
// 'Dynamic server usage: cookies' before this line.
export const dynamic = "force-dynamic";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { WORLDCUP_SIZES, type WorldcupCategory } from "@/lib/worldcup";
import { loadCommunityHomeData, loadMyWorldcups } from "@/lib/community-stats";
import { InProgressCard } from "./InProgressCard";
import { CommunityStatsBar } from "./CommunityStatsBar";
import { TrendingCommunityRow } from "./TrendingCommunityRow";
import { MyWorldcupsRow } from "./MyWorldcupsRow";
import { HomeHeroRow } from "./HomeHeroRow";

export async function generateMetadata(): Promise<Metadata> {
  const t = worldcupDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * Category + size picker. The actual bracket runs at
 * /worldcup/[cat]/[size] — keeping the picker separate makes it easy to
 * deep-link a friend to e.g. /worldcup/liked/64 ("rank your library").
 */
// next/navigation's redirect()/notFound() throw control-flow sentinels we
// MUST allow through. Catching them as "errors" would swallow the intended
// redirect and the user would get stuck on a worldcup page that should
// have bounced to /onboarding (or 404'd).
function isControlFlowError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const msg = (e as { message?: string }).message ?? "";
  const digest = (e as { digest?: string }).digest ?? "";
  return (
    msg.includes("NEXT_REDIRECT") ||
    msg.includes("NEXT_NOT_FOUND") ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_NOT_FOUND")
  );
}

export default async function WorldcupHome() {
  try {
    return await renderWorldcupHome();
  } catch (e) {
    if (isControlFlowError(e)) throw e;
    // Server-side log: this WILL appear in Cloudflare Workers logs
    // with the full stack + message (production hides client-side
    // detail but server console retains everything). The user can
    // grep the dashboard for `[worldcup-home FATAL]` to find the
    // exact failure.
    const err = e as Error & { digest?: string };
    console.error(
      `[worldcup-home FATAL] ${err.message ?? String(e)}`,
      "\nstack:",
      err.stack,
      "\ndigest:",
      err.digest,
    );
    // Friendly fallback that doesn't re-throw. error.tsx still wraps
    // child routes; this just protects /worldcup itself.
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-xl font-bold">월드컵 페이지 로드 실패</h1>
        <p className="mt-2 text-sm text-neutral-400">
          서버에서 데이터를 불러오는 중 오류가 났습니다. 잠시 후 다시 시도해
          주세요.
        </p>
        {err.digest && (
          <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 font-mono text-xs text-rose-200">
            digest: {err.digest}
          </p>
        )}
      </main>
    );
  }
}

async function renderWorldcupHome() {
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
  // Each of the three counts queries has its own .catch so a missing
  // table (recommendations on a fresh install, analysis on a not-yet-
  // analyzed library) doesn't 500 the entire worldcup home — the
  // affected card just greys out as "not enough candidates". Log the
  // failure so Cloudflare logs surface which query is unhappy.
  // Each of the three counts queries has its own .catch so a missing
  // table (recommendations on a fresh install, analysis on a not-yet-
  // analyzed library) doesn't 500 the entire worldcup home — the
  // affected card just greys out as "not enough candidates". Log the
  // failure so Cloudflare logs surface which query is unhappy.
  const sql = getSql();
  const safeCount = async (
    label: string,
    p: Promise<Array<Record<string, unknown>>>,
  ): Promise<number> => {
    try {
      const rows = await p;
      return Number((rows[0] as { n?: number } | undefined)?.n ?? 0);
    } catch (e) {
      console.error(`[worldcup] ${label} count failed:`, e);
      return 0;
    }
  };
  // Community home data (stats strip + trending row) runs in parallel
  // with the per-user counts. Both buckets independently catch on
  // failure — `safeCount` returns 0, `loadCommunityHomeData` returns
  // `{ stats: null, trending: [] }`. So even on a half-migrated deploy
  // we render the rest of the page instead of 500'ing.
  const communityHomePromise = loadCommunityHomeData().catch((e) => {
    console.error("[worldcup-home] community data failed:", e);
    return { stats: null, trending: [] };
  });

  const [libN, recN, genN] = await Promise.all([
    safeCount(
      "user_tracks",
      sql`SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}`,
    ),
    safeCount(
      "recommendations",
      sql`SELECT count(*)::int AS n FROM recommendations WHERE user_id = ${userId}`,
    ),
    // Genre count = distinct genre keys present in this user's analysed
    // tracks. Some users will only have ~5 genres at first; the
    // category card greys 16강+ until enough land in their library.
    safeCount(
      "genre",
      sql`
        SELECT count(DISTINCT k.key)::int AS n
        FROM analysis a
        JOIN user_tracks ut ON ut.track_id = a.track_id
        CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
        WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL`,
    ),
  ]);
  const { stats: communityStats, trending: communityTrending } =
    await communityHomePromise;
  // R27h — pull the signed-in user's own community worldcups so we
  // can render a "📌 내가 만든" row when they have any. Best-effort:
  // catch swallows so a failure here never blocks the home page.
  const myWorldcups = await loadMyWorldcups(userId, 4).catch(() => []);
  // Email local-part = the public handle for the "전체 보기 →" link.
  const ownerHandle =
    (session?.user?.email ?? "").split("@")[0]?.toLowerCase().trim() ||
    null;
  // `forgotten` draws from the older half of the library, so it
  // effectively halves the available pool — gate it at 2× the smallest
  // bracket so the picker doesn't offer something that will return
  // fewer cards than required.
  const counts: Record<Exclude<WorldcupCategory, "liked">, number> = {
    library:   libN,
    recent:    libN,
    forgotten: Math.floor(libN / 2),
    discover:  recN,
    mix:       libN + recN,
    genre:     genN,
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

      {/* Community pulse — small inline strip showing total
          worldcups + plays + top-3 champion items across the whole
          platform. Hides itself when there's no public activity yet
          (fresh deploy) so we don't show an awkward "0 worldcups"
          zero state. */}
      <CommunityStatsBar stats={communityStats} locale={locale} />

      {/* Trending community brackets — 3 cards above the 3-hero so a
          returning user sees concrete things to play, not just
          category navigation. Mirrors the sort logic of
          /worldcup/community?sort=trending so what surfaces here is
          consistent with the dedicated list page. */}
      <TrendingCommunityRow trending={communityTrending} locale={locale} />

      {/* R32b — Compact 3-hero with inline mode×size pickers via
          native <details>. Replaces the previous 3-hero + 6-card
          grid wall (which forced a long scroll past size buttons
          before reaching the trending feed). */}
      <HomeHeroRow locale={locale} counts={counts} />

      {/* User's own community worldcups + InProgressCard moved to
          the BOTTOM (R32b). They're high-context (user-specific)
          but low-discoverability: a user who's never made one or
          stopped mid-bracket should see trending + hero cards
          FIRST, not their own history. */}
      <MyWorldcupsRow
        items={myWorldcups}
        locale={locale}
        ownerHandle={ownerHandle}
      />
      <InProgressCard locale={locale} />

      {/* Legacy CategoryCard grid removed in R32b — its content
          now lives inside HomeHeroRow's first card. Variable left
          unused below; kept to satisfy the existing TS signature
          without a wider refactor. */}
      {false && (
        <div className="hidden">
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
      )}
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
