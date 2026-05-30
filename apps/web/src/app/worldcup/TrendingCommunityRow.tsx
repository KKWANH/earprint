import Link from "next/link";
import type { TrendingBracket } from "@/lib/community-stats";
import type { Locale } from "@/lib/i18n";
import { worldcupDict } from "@/lib/i18n/worldcup";

/**
 * Inline trending strip — 3 community brackets that are picking up
 * speed RIGHT NOW. Sits above the personal category picker so a
 * returning user sees "something other people are playing" before
 * they have to commit to a built-in mode.
 *
 * Hidden when there are no trending brackets — same hide-when-empty
 * rule as the stats bar to avoid an awkward "🔥 0 trending" state.
 */
export function TrendingCommunityRow({
  trending,
  locale,
}: {
  trending: TrendingBracket[];
  locale: Locale;
}) {
  if (trending.length === 0) return null;
  const t = worldcupDict(locale);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t.trendingHeading}
        </h2>
        <Link
          href="/worldcup/community?sort=trending"
          className="text-xs text-neutral-500 hover:text-emerald-300"
        >
          {t.trendingMore}
        </Link>
      </div>
      {/* R35 — switched from sm:grid-cols-3 (horizontal 3-up) to a
          vertical stack. User feedback: the horizontal layout cut
          the title to 2 words and felt cramped on mobile; the
          vertical stack gives each card breathing room + the
          thumbnail collage becomes wider. */}
      <div className="flex flex-col gap-3">
        {trending.map((b) => (
          <Link
            key={b.id}
            href={`/worldcup/community/${b.id}`}
            className="group flex flex-col gap-2 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-neutral-950 to-neutral-900 transition-colors hover:border-amber-400/60 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 sm:flex-row sm:items-center"
          >
            {/* 2×2 thumbnail collage from the first 4 items. Falls
                back to a flat amber tile when oEmbed didn't capture
                a thumbnail (rare but happens for member-private YT
                videos that became public later). Aspect ratio kept
                square on sm+ so the title row gets more horizontal
                space. */}
            <div className="grid aspect-[4/2] shrink-0 grid-cols-2 grid-rows-2 gap-px bg-black/40 sm:aspect-square sm:w-32">
              {Array.from({ length: 4 }).map((_, i) => {
                const p = b.previews[i];
                return p?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={p.thumbnailUrl}
                    alt={p.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    key={i}
                    className="h-full w-full bg-amber-500/10"
                  />
                );
              })}
            </div>
            <div className="flex flex-col gap-1 px-3 pb-3">
              <h3 className="line-clamp-1 text-sm font-semibold text-white">
                {b.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <span>
                  {b.itemCount}
                  {t.slotSuffix}
                </span>
                <span className="text-neutral-700">·</span>
                <span>
                  {b.playCount.toLocaleString()}
                  {t.playsSuffixSpace}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
