import Link from "next/link";
import type { CommunityStats } from "@/lib/community-stats";
import type { Locale } from "@/lib/i18n";

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
  const ko = locale === "ko";
  const { totalWorldcups, totalPlays, topChampions } = stats;
  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-neutral-300">
        <span className="font-semibold text-emerald-200">
          {ko ? "사람들 통계" : "Community pulse"}
        </span>
        <span>
          <strong className="font-semibold text-white">
            {totalWorldcups.toLocaleString()}
          </strong>
          {ko ? "개 월드컵" : " worldcups"}
        </span>
        <span className="text-neutral-600">·</span>
        <span>
          <strong className="font-semibold text-white">
            {totalPlays.toLocaleString()}
          </strong>
          {ko ? "회 진행" : " total plays"}
        </span>
      </div>
      {topChampions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-neutral-500">
            {ko ? "👑 우승 TOP" : "👑 Top champions"}
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
    </section>
  );
}
