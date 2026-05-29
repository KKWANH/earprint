import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

interface MonthlyRow { month: string; plays: number }
interface ItemHallOfFame {
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  championCount: number;
  worldcupId: string;
  worldcupTitle: string;
}
interface WorldcupSummary {
  id: string;
  title: string;
  playCount: number;
  itemCount: number;
  createdAt: Date;
  winRate: number | null;
}

interface StatsRow {
  email: string;
  totalPlays: number;
  totalChampions: number;
  monthly: MonthlyRow[];
  hallOfFame: ItemHallOfFame[];
  worldcups: WorldcupSummary[];
}

/**
 * Deeper stats view for /u/[handle]. The base profile page already
 * has the 14-day sparkline + worldcup grid; this page is the
 * "show me everything" companion. Same handle resolution shape
 * (email local-part, regex-whitelisted), so a bogus URL short-
 * circuits to notFound() without firing SQL.
 *
 * Sections:
 *   - Hero with totals (plays + champion count across all items)
 *   - 12-month plays bar chart (generate_series so the x-axis stays
 *     continuous even on quiet months)
 *   - Hall of Fame: top 10 items by champion_count across all this
 *     creator's worldcups
 *   - Worldcup list (sorted by play count) with per-bracket win-rate
 *     summary (sum of champion_count / sum of appearance_count)
 *
 * Public-by-design — same trust model as /u/[handle].
 */
async function loadStats(handle: string): Promise<StatsRow | null> {
  const sql = getSql();
  const lc = handle.toLowerCase().trim();
  if (!/^[a-z0-9._-]{1,30}$/i.test(lc)) return null;

  let userRow;
  try {
    const rows = await sql`
      SELECT u.email
      FROM users u
      WHERE lower(split_part(u.email, '@', 1)) = ${lc}
        AND EXISTS (
          SELECT 1 FROM community_worldcups w
          WHERE w.owner_user_id = u.id AND w.visibility = 'public'
        )
      LIMIT 1`;
    if (rows.length === 0) return null;
    userRow = rows[0]!;
  } catch {
    return null;
  }

  // Aggregate plays + champion count.
  let totalPlays = 0;
  let totalChampions = 0;
  try {
    const r = await sql`
      SELECT coalesce(sum(w.play_count), 0)::int AS plays,
             coalesce(sum(i.champion_count), 0)::int AS champions
      FROM community_worldcups w
      JOIN users u ON u.id = w.owner_user_id
      LEFT JOIN community_worldcup_items i ON i.worldcup_id = w.id
      WHERE w.visibility = 'public'
        AND lower(split_part(u.email, '@', 1)) = ${lc}`;
    totalPlays = Number(r[0]?.plays ?? 0);
    totalChampions = Number(r[0]?.champions ?? 0);
  } catch {
    /* leave defaults */
  }

  // 12-month plays from community_worldcup_finishes. generate_series
  // ensures every month gets a row even when no plays happened.
  let monthly: MonthlyRow[] = [];
  try {
    const rows = await sql`
      WITH months AS (
        SELECT date_trunc('month', now()) - (n || ' months')::interval AS m
        FROM generate_series(0, 11) AS n
      )
      SELECT to_char(m.m, 'YYYY-MM') AS month,
             count(f.id)::int AS plays
      FROM months m
      LEFT JOIN community_worldcup_finishes f
        ON date_trunc('month', f.finished_at) = m.m
        AND f.worldcup_id IN (
          SELECT w.id FROM community_worldcups w
          JOIN users u ON u.id = w.owner_user_id
          WHERE w.visibility = 'public'
            AND lower(split_part(u.email, '@', 1)) = ${lc}
        )
      GROUP BY m.m
      ORDER BY m.m ASC`;
    monthly = rows.map((r) => ({
      month: r.month as string,
      plays: Number(r.plays ?? 0),
    }));
  } catch {
    /* leave empty */
  }

  // Hall of Fame — top 10 items (across this creator's worldcups) by
  // champion_count. Each item links back to its parent worldcup.
  let hallOfFame: ItemHallOfFame[] = [];
  try {
    const rows = await sql`
      SELECT i.title, i.subtitle, i.thumbnail_url AS "thumbnailUrl",
             i.champion_count AS "championCount",
             i.worldcup_id::text AS "worldcupId",
             w.title AS "worldcupTitle"
      FROM community_worldcup_items i
      JOIN community_worldcups w ON w.id = i.worldcup_id
      JOIN users u ON u.id = w.owner_user_id
      WHERE w.visibility = 'public'
        AND lower(split_part(u.email, '@', 1)) = ${lc}
        AND i.champion_count > 0
      ORDER BY i.champion_count DESC, i.win_count DESC
      LIMIT 10`;
    hallOfFame = rows.map((r) => ({
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      thumbnailUrl: (r.thumbnailUrl as string | null) ?? null,
      championCount: Number(r.championCount ?? 0),
      worldcupId: r.worldcupId as string,
      worldcupTitle: r.worldcupTitle as string,
    }));
  } catch {
    /* leave empty */
  }

  // Per-worldcup with derived win-rate.
  let worldcups: WorldcupSummary[] = [];
  try {
    const rows = await sql`
      SELECT w.id::text AS id, w.title,
             w.play_count AS "playCount",
             w.created_at AS "createdAt",
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS "itemCount",
             (SELECT coalesce(sum(i.champion_count), 0)::float /
                NULLIF(sum(i.appearance_count), 0)
              FROM community_worldcup_items i
              WHERE i.worldcup_id = w.id) AS "winRate"
      FROM community_worldcups w
      JOIN users u ON u.id = w.owner_user_id
      WHERE w.visibility = 'public'
        AND lower(split_part(u.email, '@', 1)) = ${lc}
      ORDER BY w.play_count DESC, w.created_at DESC
      LIMIT 60`;
    worldcups = rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      playCount: Number(r.playCount ?? 0),
      itemCount: Number(r.itemCount ?? 0),
      createdAt: new Date(r.createdAt as string),
      winRate: r.winRate != null ? Number(r.winRate) : null,
    }));
  } catch {
    /* leave empty */
  }

  return {
    email: userRow.email as string,
    totalPlays,
    totalChampions,
    monthly,
    hallOfFame,
    worldcups,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} stats — Earprint`,
    robots: { index: false, follow: false },
  };
}

export default async function CreatorStats({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const data = await loadStats(handle);
  if (!data) notFound();
  const locale = await getLocale();
  const ko = locale === "ko";
  const monthMax = Math.max(1, ...data.monthly.map((m) => m.plays));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={`/u/${encodeURIComponent(handle)}`}
        className="text-xs text-neutral-500 hover:text-white"
      >
        ← @{handle}
      </Link>

      <header className="flex flex-col gap-2 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-neutral-950 to-neutral-900 p-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">@{handle} {ko ? "통계" : "stats"}</h1>
        <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
          <span>
            {ko ? "총 진행" : "Total plays"}:{" "}
            <strong className="font-semibold text-white">
              {data.totalPlays.toLocaleString()}
            </strong>
          </span>
          <span>·</span>
          <span>
            {ko ? "총 우승 횟수" : "Total champions crowned"}:{" "}
            <strong className="font-semibold text-white">
              {data.totalChampions.toLocaleString()}
            </strong>
          </span>
        </div>
      </header>

      {/* Monthly bar chart */}
      {data.monthly.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {ko ? "월별 진행 (12개월)" : "Monthly plays (12 months)"}
          </h2>
          <div className="flex h-24 items-end gap-1.5">
            {data.monthly.map((m) => {
              const h = m.plays > 0 ? (m.plays / monthMax) * 100 : 0;
              return (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-[10px] text-neutral-500">
                    {m.plays > 0 ? m.plays.toLocaleString() : ""}
                  </span>
                  <div
                    className="w-full rounded-t bg-sky-500/70"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] text-neutral-600">
                    {m.month.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Hall of Fame */}
      {data.hallOfFame.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/15 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
            {ko ? "👑 우승 명예의 전당" : "👑 Hall of Fame"}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {data.hallOfFame.map((it, i) => (
              <li key={`${it.worldcupId}-${i}`}>
                <Link
                  href={`/worldcup/community/${it.worldcupId}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5"
                >
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-amber-300">
                    {i + 1}
                  </span>
                  {it.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.thumbnailUrl}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-14 shrink-0 rounded bg-neutral-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-white">{it.title}</p>
                    {it.subtitle && (
                      <p className="line-clamp-1 text-[11px] text-neutral-500">
                        {it.subtitle} · {it.worldcupTitle}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-200">
                    ×{it.championCount.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Per-worldcup table */}
      {data.worldcups.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {ko ? "월드컵별 통계" : "Per-worldcup"}
          </h2>
          <ul className="flex flex-col gap-1">
            {data.worldcups.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/worldcup/community/${w.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                >
                  <span className="min-w-0 flex-1 truncate">{w.title}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {w.itemCount}
                    {ko ? "강" : "-slot"}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {w.playCount.toLocaleString()}
                  </span>
                  {w.winRate != null && (
                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
                      win-rate {Math.round(w.winRate * 100)}%
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
