import type { Metadata } from "next";
import Link from "next/link";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Recent results — Earprint Community Worldcups",
    description: "Live feed of recent community worldcup champions",
  };
}

/**
 * /worldcup/community/recent — live-ish feed of the most recent
 * community-bracket finishes. Each entry shows the champion item
 * (with thumbnail), the worldcup it won, and how long ago the play
 * finished.
 *
 * Anonymous-friendly (no auth gate). Source: community_worldcup
 * _finishes JOIN community_worldcup_items + community_worldcups.
 * Capped at 50 rows — pagination would be a v2 once the feed has
 * meaningful volume.
 *
 * Wrapped in try/catch — the finishes table is from R24d migration;
 * older deploys degrade to empty list rather than 500-ing.
 */

interface Row {
  finishedAt: Date;
  championTitle: string;
  championSubtitle: string | null;
  thumbnailUrl: string | null;
  worldcupId: string;
  worldcupTitle: string;
  ownerHandle: string | null;
}

async function loadRecent(): Promise<Row[]> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT f.finished_at,
             i.title AS champion_title,
             i.subtitle AS champion_subtitle,
             i.thumbnail_url AS thumbnail_url,
             w.id::text AS worldcup_id,
             w.title AS worldcup_title,
             u.email AS owner_email
      FROM community_worldcup_finishes f
      JOIN community_worldcup_items i ON i.id = f.champion_item_id
      JOIN community_worldcups w ON w.id = f.worldcup_id
      LEFT JOIN users u ON u.id = w.owner_user_id
      WHERE w.visibility = 'public'
      ORDER BY f.finished_at DESC
      LIMIT 50`;
    return rows.map((r) => ({
      finishedAt: new Date(r.finished_at as string),
      championTitle: r.champion_title as string,
      championSubtitle: (r.champion_subtitle as string | null) ?? null,
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      worldcupId: r.worldcup_id as string,
      worldcupTitle: r.worldcup_title as string,
      ownerHandle: (r.owner_email as string | null)?.split("@")[0]?.toLowerCase() ?? null,
    }));
  } catch {
    return [];
  }
}

function relativeTime(d: Date, ko: boolean): string {
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return ko ? "방금" : "just now";
  if (min < 60) return ko ? `${min}분 전` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return ko ? `${hr}시간 전` : `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return ko ? `${days}일 전` : `${days}d ago`;
  return d.toLocaleDateString(ko ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
}

export default async function RecentResults() {
  const rows = await loadRecent();
  const locale = await getLocale();
  const ko = locale === "ko";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/worldcup/community"
        className="text-xs text-neutral-500 hover:text-white"
      >
        ← {ko ? "커뮤니티" : "Community"}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {ko ? "🏁 최근 결과" : "🏁 Recent results"}
        </h1>
        <p className="text-sm text-neutral-400">
          {ko
            ? "방금 끝난 커뮤니티 월드컵의 우승곡 라이브 피드."
            : "Live feed of the most recent community worldcup champions."}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
          {ko
            ? "아직 결과가 없어요. 누군가 월드컵을 끝내면 여기에 표시됩니다."
            : "No results yet. Finished worldcups will show up here."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
            >
              {r.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  className="h-12 w-16 shrink-0 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-12 w-16 shrink-0 rounded bg-neutral-800" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-amber-300">🏆</span>
                  <p className="line-clamp-1 text-sm font-semibold">
                    {r.championTitle}
                  </p>
                </div>
                {r.championSubtitle && (
                  <p className="line-clamp-1 text-[11px] text-neutral-500">
                    {r.championSubtitle}
                  </p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                  <Link
                    href={`/worldcup/community/${r.worldcupId}`}
                    className="hover:text-emerald-300 hover:underline"
                  >
                    {r.worldcupTitle}
                  </Link>
                  {r.ownerHandle && (
                    <>
                      <span className="text-neutral-700">·</span>
                      <Link
                        href={`/u/${encodeURIComponent(r.ownerHandle)}`}
                        className="hover:text-sky-300 hover:underline"
                      >
                        @{r.ownerHandle}
                      </Link>
                    </>
                  )}
                  <span className="text-neutral-700">·</span>
                  <span>{relativeTime(r.finishedAt, ko)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
