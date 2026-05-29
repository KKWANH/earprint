import Link from "next/link";
import type { CommunityStats } from "@/lib/community-stats";
import type { Locale } from "@/lib/i18n";
import { worldcupDict } from "@/lib/i18n/worldcup";

/**
 * One-line community pulse, rendered just below the worldcup header.
 * Renders nothing when stats are null (fresh deploy, no public
 * brackets) so the home page doesn't show an empty "0 worldcups" zero
 * state — that feels worse than just hiding the strip until activity
 * exists.
 */
export function CommunityStatsBar({
  stats,
  locale,
}: {
  stats: CommunityStats | null;
  locale: Locale;
}) {
  if (!stats) return null;
  const t = worldcupDict(locale);
  const { totalWorldcups, totalPlays, playsThisWeek, topChampions, topCreators } =
    stats;
  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-neutral-300">
        <span className="font-semibold text-emerald-200">
          {t.pulseTitle}
        </span>
        <span>
          <strong className="font-semibold text-white">
            {totalWorldcups.toLocaleString()}
          </strong>
          {t.pulseWorldcupsSuffix}
        </span>
        <span className="text-neutral-600">·</span>
        <span>
          <strong className="font-semibold text-white">
            {totalPlays.toLocaleString()}
          </strong>
          {t.pulseTotalPlaysSuffix}
        </span>
        {/* "This week" segment hides itself when the finishes table
            isn't migrated yet (playsThisWeek=null), so we don't show
            an awkward "0회" when the feature is simply unavailable.
            When migrated and genuinely 0, the segment still renders
            so the user sees the metric is live. */}
        {playsThisWeek != null && (
          <>
            <span className="text-neutral-600">·</span>
            <span>
              {t.pulseThisWeekPrefix}
              <strong className="font-semibold text-white">
                {playsThisWeek.toLocaleString()}
              </strong>
              {t.pulseThisWeekSuffix}
            </span>
          </>
        )}
      </div>
      {topChampions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-neutral-500">
            {t.pulseTopChampions}
          </span>
          {topChampions.map((c, i) => (
            <Link
              key={`${c.worldcupId}-${i}`}
              href={`/worldcup/community/${c.worldcupId}`}
              className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100 hover:bg-amber-500/20"
              title={
                c.subtitle
                  ? `${c.title} — ${c.subtitle}`
                  : c.title
              }
            >
              <span className="font-semibold">{i + 1}</span>
              <span className="max-w-[12ch] truncate">{c.title}</span>
              <span className="text-amber-300/70">
                ×{c.championCount.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
      {/* Creator leaderboard — appears once at least one creator
          has a non-zero total-plays sum. Doesn't require the finishes
          table; pure aggregate on community_worldcups.play_count.
          Each chip links to /u/<handle> (R26b) — the creator's
          public profile showing all their worldcups. */}
      {topCreators.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-neutral-500">
            {t.pulseTopCreators}
          </span>
          {topCreators.map((c, i) => (
            <Link
              key={`${c.handle}-${i}`}
              href={`/u/${encodeURIComponent(c.handle)}`}
              className="flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-100 hover:bg-sky-500/20"
              title={t.pulseCreatorTooltip(c.worldcupCount, c.totalPlays)}
            >
              <span className="font-semibold">{i + 1}</span>
              <span className="max-w-[14ch] truncate">{c.handle}</span>
              <span className="text-sky-300/70">
                ×{c.totalPlays.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
