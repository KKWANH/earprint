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
  return {
    email: rows[0]!.email as string,
    worldcups,
    totalPlays,
  };
}

export async function generateMetadata({
  params,
}: CreatorPageProps): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} — Earprint`,
    description: `Worldcups made by @${handle}`,
    openGraph: { title: `@${handle} on Earprint`, type: "profile" },
    twitter: { card: "summary" },
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
  const locale = await getLocale();
  const ko = locale === "ko";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/worldcup/community" className="text-xs text-neutral-500 hover:text-white">
        {ko ? "← 커뮤니티" : "← Community"}
      </Link>

      <header className="flex flex-col gap-2 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-neutral-950 to-neutral-900 p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
          {ko ? "Worldcup 메이커" : "Worldcup creator"}
        </p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">@{handle}</h1>
        <p className="text-xs text-neutral-400">
          {ko
            ? `${data.worldcups.length}개 월드컵 · 총 ${data.totalPlays.toLocaleString()}회 진행`
            : `${data.worldcups.length} worldcups · ${data.totalPlays.toLocaleString()} total plays`}
        </p>
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
    </main>
  );
}
