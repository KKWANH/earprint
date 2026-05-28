import Link from "next/link";
import type { TrendingBracket } from "@/lib/community-stats";
import type { Locale } from "@/lib/i18n";

/**
 * "📌 내가 만든 월드컵" strip on /worldcup home for signed-in users
 * who have shipped at least one community worldcup. Same visual
 * language as TrendingCommunityRow (compact card + 2×2 thumbnail
 * collage) so the page surface stays coherent. Hidden when the user
 * has no community worldcups yet (signed-in but no creates), and
 * also hidden for not-yet-signed-in users via the upstream check.
 */
export function MyWorldcupsRow({
  items,
  locale,
  ownerHandle,
}: {
  items: TrendingBracket[];
  locale: Locale;
  /** Used to deep-link "전체 보기" to /u/<handle> when present.
   *  When null, the section still renders but the right-side "전체"
   *  link is hidden (rare edge case where the user has no email
   *  local-part to use as a handle). */
  ownerHandle: string | null;
}) {
  if (items.length === 0) return null;
  const ko = locale === "ko";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {ko ? "📌 내가 만든 월드컵" : "📌 My worldcups"}
        </h2>
        {ownerHandle && (
          <Link
            href={`/u/${encodeURIComponent(ownerHandle)}`}
            className="text-xs text-neutral-500 hover:text-emerald-300"
          >
            {ko ? "전체 보기 →" : "View all →"}
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {items.map((b) => (
          <Link
            key={b.id}
            href={`/worldcup/community/${b.id}`}
            className="group flex flex-col gap-2 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-neutral-950 to-neutral-900 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/10"
          >
            <div className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-px bg-black/40">
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
                  <div key={i} className="h-full w-full bg-emerald-500/10" />
                );
              })}
            </div>
            <div className="flex flex-col gap-0.5 px-2.5 pb-2.5">
              <h3 className="line-clamp-1 text-xs font-semibold text-white">
                {b.title}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                <span>
                  {b.itemCount}
                  {ko ? "강" : "-slot"}
                </span>
                <span className="text-neutral-700">·</span>
                <span>
                  {b.playCount.toLocaleString()}
                  {ko ? "회" : ""}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
