import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

interface CreatorPageProps {
  params: Promise<{ handle: string }>;
}

interface CreatorWorldcup {
  id: string;
  title: string;
  description: string | null;
  playCount: number;
  itemCount: number;
  createdAt: Date;
  previews: { thumbnailUrl: string | null; title: string }[];
}

interface CreatorRow {
  email: string;
  worldcups: CreatorWorldcup[];
  totalPlays: number;
  /** 14-day plays-per-day histogram (R28f). Each entry is one day,
   *  oldest first. Populated from community_worldcup_finishes joined
   *  to community_worldcups by owner. Empty array when the finishes
   *  table isn't migrated yet — the sparkline just hides. */
  recentPlays: { day: string; count: number }[];
}

/**
 * Load every public worldcup made by the user whose email local-part
 * matches `handle`. We match on lower(split_part(email,'@',1)) so the
 * URL is the part-before-the-@ (same shape the CommunityStatsBar
 * already surfaces as the creator chip's label).
 *
 * Returns null when no matching creator exists — page renders 404.
 *
 * Sort: play_count DESC (their biggest hit first). Cap at 60 — the
 * page is a profile, not an archive; runaway creators with hundreds
 * of brackets get truncated with a note (kept for v1 to add
 * pagination if anyone actually hits the cap).
 */
async function loadCreator(handle: string): Promise<CreatorRow | null> {
  const sql = getSql();
  const lc = handle.toLowerCase().trim();
  // Handle has same shape constraint as the chip — letters / digits /
  // dots / hyphens / underscores. Reject anything outside that so we
  // don't fire a SQL query for a clearly-bogus URL.
  if (!/^[a-z0-9._-]{1,30}$/i.test(lc)) return null;

  let rows;
  try {
    rows = await sql`
      SELECT w.id::text AS id, w.title, w.description, w.play_count AS "playCount",
             w.created_at AS "createdAt", u.email,
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS "itemCount"
      FROM community_worldcups w
      JOIN users u ON u.id = w.owner_user_id
      WHERE w.visibility = 'public'
        AND lower(split_part(u.email, '@', 1)) = ${lc}
      ORDER BY w.play_count DESC, w.created_at DESC
      LIMIT 60`;
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  // Fetch the first 4 item thumbnails per worldcup — one extra query
  // each, capped at 60 brackets = 60 sub-queries. The page is a profile
  // (not a hot path) so this is fine without further batching.
  const worldcups: CreatorWorldcup[] = await Promise.all(
    rows.map(async (r) => {
      let previews: CreatorWorldcup["previews"] = [];
      try {
        const itemRows = await sql`
          SELECT thumbnail_url AS "thumbnailUrl", title
          FROM community_worldcup_items
          WHERE worldcup_id = ${r.id}::uuid
          ORDER BY position ASC
          LIMIT 4`;
        previews = itemRows.map((it) => ({
          thumbnailUrl: (it.thumbnailUrl as string | null) ?? null,
          title: it.title as string,
        }));
      } catch {
        /* leave empty */
      }
      return {
        id: r.id as string,
        title: r.title as string,
        description: (r.description as string | null) ?? null,
        playCount: Number(r.playCount ?? 0),
        itemCount: Number(r.itemCount ?? 0),
        createdAt: new Date(r.createdAt as string),
        previews,
      };
    }),
  );
  const totalPlays = worldcups.reduce((s, w) => s + w.playCount, 0);

  // 14-day plays-per-day for the sparkline. generate_series gives us
  // a row per day even when nothing happened, so the chart x-axis
  // doesn't collapse on quiet days. Wrapped in try/catch because
  // community_worldcup_finishes is the table from R24d — present on
  // deploys that ran the migration, absent on older ones.
  let recentPlays: CreatorRow["recentPlays"] = [];
  try {
    const histRows = await sql`
      WITH days AS (
        SELECT (date_trunc('day', now()) - (n || ' days')::interval) AS day
        FROM generate_series(0, 13) AS n
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             count(f.id)::int AS n
      FROM days d
      LEFT JOIN community_worldcup_finishes f
        ON date_trunc('day', f.finished_at) = d.day
        AND f.worldcup_id IN (
          SELECT w.id FROM community_worldcups w
          JOIN users u ON u.id = w.owner_user_id
          WHERE w.visibility = 'public'
            AND lower(split_part(u.email, '@', 1)) = ${lc}
        )
      GROUP BY d.day
      ORDER BY d.day ASC`;
    recentPlays = histRows.map((r) => ({
      day: r.day as string,
      count: Number(r.n ?? 0),
    }));
  } catch {
    /* finishes table missing — leave [] */
  }

  return {
    email: rows[0]!.email as string,
    worldcups,
    totalPlays,
    recentPlays,
  };
}

/**
 * R39 — the creator's published taste-share id, if any. Joins the
 * handle (email local-part) to taste_profiles. A non-null share_id is
 * the ONLY consent signal: it means they opted into exposing their
 * aggregate taste. Being a worldcup creator is NOT consent on its
 * own, so the "compare taste" affordance is gated on this. Returns
 * null when they haven't published a taste profile.
 */
async function loadShareIdByHandle(handle: string): Promise<string | null> {
  const lc = handle.toLowerCase().trim();
  if (!/^[a-z0-9._-]{1,30}$/i.test(lc)) return null;
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT tp.share_id
      FROM users u
      JOIN taste_profiles tp ON tp.user_id = u.id
      WHERE lower(split_part(u.email, '@', 1)) = ${lc}
        AND tp.share_id IS NOT NULL
      LIMIT 1`;
    return (rows[0]?.share_id as string | null) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: CreatorPageProps): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} — Earprint`,
    description: `Worldcups made by @${handle}`,
    // OG image lives at opengraph-image.tsx adjacent — Next.js
    // auto-attaches it, but bumping the card to summary_large_image
    // makes Twitter render it at full width.
    openGraph: { title: `@${handle} on Earprint`, type: "profile" },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * Public profile page for a worldcup creator. Reachable from the
 * CommunityStatsBar's creator chip and from any community worldcup's
 * "made by @<handle>" byline.
 *
 * No auth gate — profiles are public-by-design (a user's published
 * worldcups already are; the profile is just the rollup). We never
 * expose email here, only the local-part.
 */
export default async function CreatorProfile({ params }: CreatorPageProps) {
  const { handle } = await params;
  const data = await loadCreator(handle);
  if (!data) notFound();
  const shareId = await loadShareIdByHandle(handle);
  const locale = await getLocale();
  const ko = locale === "ko";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/worldcup/community" className="text-xs text-neutral-500 hover:text-white">
        {ko ? "← 커뮤니티" : "← Community"}
      </Link>

      <header className="flex flex-col gap-3 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-neutral-950 to-neutral-900 p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
          {ko ? "Worldcup 메이커" : "Worldcup creator"}
        </p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">@{handle}</h1>
        <p className="text-xs text-neutral-400">
          {ko
            ? `${data.worldcups.length}개 월드컵 · 총 ${data.totalPlays.toLocaleString()}회 진행`
            : `${data.worldcups.length} worldcups · ${data.totalPlays.toLocaleString()} total plays`}
        </p>
        {/* R28f — 14-day sparkline. Hidden when there's no play
            activity at all (sum=0) since a flat line would be more
            depressing than informative. */}
        {data.recentPlays.length > 0 &&
          data.recentPlays.some((d) => d.count > 0) && (
            <Sparkline data={data.recentPlays} ko={ko} />
          )}
        {/* R39 — taste compare, only when this creator has published a
            taste share (consent). Links to /s/<id> + /compare?with=<id>. */}
        {shareId && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/s/${shareId}`}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              {ko ? "🎧 취향 보기" : "🎧 View their taste"}
            </Link>
            <Link
              href={`/compare?with=${shareId}`}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
            >
              {ko ? "↔ 내 취향과 비교" : "↔ Compare with mine"}
            </Link>
          </div>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {data.worldcups.map((w) => (
          <Link
            key={w.id}
            href={`/worldcup/community/${w.id}`}
            className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
          >
            {/* 2×2 thumbnail collage from the first 4 items — same
                visual language as the trending row on /worldcup home,
                so the profile feels continuous with the rest of the
                community surface. */}
            <div className="grid aspect-[16/9] grid-cols-2 grid-rows-2 gap-px bg-black/40">
              {Array.from({ length: 4 }).map((_, i) => {
                const p = w.previews[i];
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
                  <div key={i} className="h-full w-full bg-white/5" />
                );
              })}
            </div>
            <div className="flex flex-col gap-1 px-3 pb-3">
              <h2 className="line-clamp-2 text-sm font-semibold text-white">
                {w.title}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span>
                  {w.itemCount}
                  {ko ? "강" : "-slot"}
                </span>
                <span className="text-neutral-700">·</span>
                <span>
                  {w.playCount.toLocaleString()}
                  {ko ? "회" : " plays"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {data.worldcups.length === 60 && (
        <p className="text-center text-[11px] text-neutral-600">
          {ko
            ? "60개까지만 표시됩니다."
            : "Showing the first 60 worldcups."}
        </p>
      )}

      {/* R30c — deeper stats companion page. The base profile shows
          headline counts + sparkline; the stats page has the 12-month
          chart, hall-of-fame items, per-worldcup breakdowns. */}
      <Link
        href={`/u/${encodeURIComponent(handle)}/stats`}
        className="self-center text-xs text-sky-300 hover:text-sky-200 hover:underline"
      >
        {ko ? "📊 상세 통계 보기 →" : "📊 View detailed stats →"}
      </Link>
    </main>
  );
}

/**
 * Inline SVG sparkline — 14 day bars, no axis, no labels. Width
 * stretches to container; height fixed at 40px. Bar height
 * normalises against the local max so even a single play day is
 * visually meaningful.
 *
 * Rendered as plain SVG with calculated x/y values rather than a
 * charting library — the data is tiny (14 entries) and keeping the
 * dependency surface light on the public profile page matters more
 * than chart richness.
 */
function Sparkline({
  data,
  ko,
}: {
  data: { day: string; count: number }[];
  ko: boolean;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 280;
  const H = 40;
  const gap = 2;
  const barW = (W - gap * (data.length - 1)) / data.length;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-10 w-full max-w-[280px]"
        aria-label={
          ko
            ? `최근 14일 플레이 ${total.toLocaleString()}회`
            : `last 14 days ${total.toLocaleString()} plays`
        }
      >
        {data.map((d, i) => {
          const h = d.count > 0 ? (d.count / max) * (H - 2) : 0;
          const x = i * (barW + gap);
          const y = H - h;
          return (
            <rect
              key={d.day}
              x={x}
              y={y}
              width={barW}
              height={h || 1}
              rx={1}
              fill={d.count > 0 ? "#38bdf8" : "#1e293b"}
            />
          );
        })}
      </svg>
      <span className="shrink-0 text-[10px] text-neutral-500">
        {ko ? "최근 14일" : "Last 14 days"}
      </span>
    </div>
  );
}
