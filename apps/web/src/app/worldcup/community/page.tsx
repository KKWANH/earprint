import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Community worldcups — Earprint" };
}

/**
 * /worldcup/community — list public UGC worldcups. Three sort modes:
 *
 *   ?sort=popular  (default) — play_count DESC, all-time. Established
 *                              hits first.
 *   ?sort=trending           — plays-per-day-since-creation. Newer
 *                              brackets with traction surface above
 *                              old long-tail favourites. Pure
 *                              expression, no snapshot table needed.
 *   ?sort=new                — created_at DESC. For people scrolling
 *                              for stuff they haven't seen yet.
 *
 * Anonymous-friendly (no sign-in gate) — only the Create CTA gates.
 */
export default async function CommunityList({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    tag?: string;
    creator?: string;
    q?: string;
  }>;
}) {
  const locale = await getLocale();
  const ko = locale === "ko";
  const sql = getSql();
  const { sort, tag: rawTag, creator: rawCreator, q: rawQ } = await searchParams;
  const mode = sort === "trending" ? "trending" : sort === "new" ? "new" : "popular";
  const tag = rawTag ? rawTag.toLowerCase().trim() : "";
  // R30e — text search over title + tags + description. Trimmed,
  // capped at 100 chars to defang abuse. ilike pattern wraps in %.
  const qRaw = rawQ?.trim().slice(0, 100) ?? "";
  const q = qRaw.toLowerCase();
  // R27i — `?creator=<handle>` filter. Same handle resolution
  // /u/[handle] uses (email local-part, regex whitelisted) so a
  // crafted URL can't fire a SQL injection or expand the filter to
  // arbitrary email matches.
  const creatorHandle =
    rawCreator && /^[a-z0-9._-]{1,30}$/i.test(rawCreator.trim())
      ? rawCreator.toLowerCase().trim()
      : "";

  // tags column may not exist on older DBs (migration not applied yet)
  // — catch + fall back to "no tags shown / no tag filter" so the
  // list still renders. Same defensive pattern as library.ts.
  type Row = {
    id: string;
    title: string;
    description: string | null;
    play_count: number;
    created_at: string;
    item_count: number;
    tags?: string[];
  };
  const fetchWithTags = async (): Promise<Row[]> => {
    const orderClause =
      mode === "trending"
        ? sql`(w.play_count::real /
                greatest(1, extract(epoch from (now() - w.created_at)) / 86400.0)) DESC,
              w.created_at DESC`
        : mode === "new"
          ? sql`w.created_at DESC`
          : sql`w.play_count DESC, w.created_at DESC`;
    // R30e — when text search is active, fall back to a single
    // "ilike on title OR description OR exists-in-tags" branch
    // regardless of other filters. ilike isn't index-friendly but
    // we LIMIT 100 anyway and the table is small.
    if (q) {
      const pat = `%${q}%`;
      const tagFilter = tag
        ? sql`AND ${tag} = ANY(w.tags)`
        : sql``;
      const creatorFilter = creatorHandle
        ? sql`AND lower(split_part(u.email, '@', 1)) = ${creatorHandle}`
        : sql``;
      return (await sql`
        SELECT w.id, w.title, w.description, w.play_count, w.created_at, w.tags,
               (SELECT count(*)::int FROM community_worldcup_items i
                  WHERE i.worldcup_id = w.id) AS item_count
        FROM community_worldcups w
        LEFT JOIN users u ON u.id = w.owner_user_id
        WHERE w.visibility = 'public'
          AND (
            lower(w.title) LIKE ${pat}
            OR lower(coalesce(w.description, '')) LIKE ${pat}
            OR EXISTS (SELECT 1 FROM unnest(w.tags) AS t WHERE lower(t) LIKE ${pat})
          )
          ${tagFilter}
          ${creatorFilter}
        ORDER BY ${orderClause}
        LIMIT 100`) as Row[];
    }
    // Three filter axes: tag + creator handle + (always-on) public
    // visibility. Each filter has its own branch because the neon
    // tagged-template driver doesn't compose AND-able WHERE fragments
    // cleanly; explicit shapes keep the SQL readable + indexable.
    if (tag && creatorHandle) {
      return (await sql`
        SELECT w.id, w.title, w.description, w.play_count, w.created_at, w.tags,
               (SELECT count(*)::int FROM community_worldcup_items i
                  WHERE i.worldcup_id = w.id) AS item_count
        FROM community_worldcups w
        JOIN users u ON u.id = w.owner_user_id
        WHERE w.visibility = 'public'
          AND ${tag} = ANY(w.tags)
          AND lower(split_part(u.email, '@', 1)) = ${creatorHandle}
        ORDER BY ${orderClause}
        LIMIT 100`) as Row[];
    }
    if (tag) {
      return (await sql`
        SELECT w.id, w.title, w.description, w.play_count, w.created_at, w.tags,
               (SELECT count(*)::int FROM community_worldcup_items i
                  WHERE i.worldcup_id = w.id) AS item_count
        FROM community_worldcups w
        WHERE w.visibility = 'public' AND ${tag} = ANY(w.tags)
        ORDER BY ${orderClause}
        LIMIT 100`) as Row[];
    }
    if (creatorHandle) {
      return (await sql`
        SELECT w.id, w.title, w.description, w.play_count, w.created_at, w.tags,
               (SELECT count(*)::int FROM community_worldcup_items i
                  WHERE i.worldcup_id = w.id) AS item_count
        FROM community_worldcups w
        JOIN users u ON u.id = w.owner_user_id
        WHERE w.visibility = 'public'
          AND lower(split_part(u.email, '@', 1)) = ${creatorHandle}
        ORDER BY ${orderClause}
        LIMIT 100`) as Row[];
    }
    return (await sql`
      SELECT w.id, w.title, w.description, w.play_count, w.created_at, w.tags,
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS item_count
      FROM community_worldcups w
      WHERE w.visibility = 'public'
      ORDER BY ${orderClause}
      LIMIT 100`) as Row[];
  };
  const fetchWithoutTags = async (): Promise<Row[]> => {
    const orderClause =
      mode === "trending"
        ? sql`(w.play_count::real /
                greatest(1, extract(epoch from (now() - w.created_at)) / 86400.0)) DESC,
              w.created_at DESC`
        : mode === "new"
          ? sql`w.created_at DESC`
          : sql`w.play_count DESC, w.created_at DESC`;
    return (await sql`
      SELECT w.id, w.title, w.description, w.play_count, w.created_at,
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS item_count
      FROM community_worldcups w
      WHERE w.visibility = 'public'
      ORDER BY ${orderClause}
      LIMIT 100`) as Row[];
  };
  let rows: Row[];
  try {
    rows = await fetchWithTags();
  } catch (e1) {
    console.error("[community-list] tags query failed; falling back:", e1);
    try {
      rows = await fetchWithoutTags();
    } catch (e2) {
      // Final fallback: the community_worldcups table itself probably
      // doesn't exist on this deploy (schema migration not run yet).
      // Surface an empty list instead of 500'ing the page so the
      // create CTA still works.
      console.error("[community-list] base query also failed:", e2);
      rows = [];
    }
  }

  // Sample of the most-used tags across the listed brackets — surfaces
  // a quick "browse by k-pop / indie / 2020s" affordance. Pure
  // client-side aggregation, no extra SQL.
  const tagCounts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.tags ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t]) => t);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <Link
            href="/worldcup"
            className="text-xs text-neutral-500 hover:text-white"
          >
            ← {ko ? "월드컵 홈" : "Worldcup home"}
          </Link>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {ko ? "커뮤니티 월드컵" : "Community worldcups"}
          </h1>
          {/* R27i — surface the active creator filter so users can
              see why their list looks short, and click out of it
              back to the full feed. */}
          {creatorHandle && (
            <p className="mt-1 text-xs text-sky-300">
              {ko ? "메이커 " : "by "}
              <Link
                href={`/u/${encodeURIComponent(creatorHandle)}`}
                className="underline hover:text-sky-200"
              >
                @{creatorHandle}
              </Link>
              {" "}·{" "}
              <Link
                href={
                  tag
                    ? `/worldcup/community?tag=${encodeURIComponent(tag)}`
                    : "/worldcup/community"
                }
                className="text-neutral-500 hover:text-white"
              >
                {ko ? "필터 해제" : "clear filter"}
              </Link>
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-400">
            {ko
              ? "다른 사람이 만든 토너먼트. 누구든 플레이 가능."
              : "Tournaments other people made. Anyone can play."}
          </p>
        </div>
        <Link
          href="/worldcup/community/create"
          className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {ko ? "+ 만들기" : "+ Create"}
        </Link>
      </header>

      {/* R30e — text search across title / tags / description. GET
          form so URL is shareable + bookmarkable. Preserves other
          filters via hidden inputs so submitting search doesn't
          erase the user's chosen sort / tag / creator. */}
      <form
        method="GET"
        action="/worldcup/community"
        className="flex items-center gap-2"
      >
        {mode !== "popular" && (
          <input type="hidden" name="sort" value={mode} />
        )}
        {tag && <input type="hidden" name="tag" value={tag} />}
        {creatorHandle && (
          <input type="hidden" name="creator" value={creatorHandle} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={qRaw}
          placeholder={ko ? "제목·태그·설명 검색…" : "Search title / tags / description…"}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
        />
        {qRaw && (
          <Link
            href={
              (() => {
                const qp = new URLSearchParams();
                if (mode !== "popular") qp.set("sort", mode);
                if (tag) qp.set("tag", tag);
                if (creatorHandle) qp.set("creator", creatorHandle);
                const qs = qp.toString();
                return qs ? `/worldcup/community?${qs}` : "/worldcup/community";
              })()
            }
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            {ko ? "지우기" : "Clear"}
          </Link>
        )}
      </form>

      {/* Sort tab strip. Three modes ride the same query param so a
          bookmarked tab survives refresh. Active state is the one
          whose querystring matches `mode`; others link to themselves
          via a small `<Link>`. */}
      <nav className="flex gap-1.5 text-xs">
        {(
          [
            { id: "popular", label: ko ? "🏆 인기" : "🏆 Popular" },
            { id: "trending", label: ko ? "📈 트렌딩" : "📈 Trending" },
            { id: "new", label: ko ? "🆕 새로 나온" : "🆕 New" },
          ] as const
        ).map((tab) => {
          const qp = new URLSearchParams();
          if (tab.id !== "popular") qp.set("sort", tab.id);
          if (tag) qp.set("tag", tag);
          if (creatorHandle) qp.set("creator", creatorHandle);
          if (qRaw) qp.set("q", qRaw);
          const qs = qp.toString();
          const href = qs ? `/worldcup/community?${qs}` : "/worldcup/community";
          const active = mode === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`rounded-full border px-3 py-1 transition-colors ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-white"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
          {ko
            ? "아직 만들어진 월드컵이 없습니다. 첫 번째로 만들어 보세요."
            : "No worldcups yet — be the first to make one."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id as string}>
              <Link
                href={`/worldcup/community/${r.id as string}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
              >
                <h2 className="text-base font-semibold">{r.title as string}</h2>
                {r.description ? (
                  <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                    {r.description as string}
                  </p>
                ) : null}
                {(r.tags ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(r.tags ?? []).slice(0, 5).map((tg) => (
                      <span
                        key={tg}
                        className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400"
                      >
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                  <span>{r.item_count as number}{ko ? "강" : "-slot"}</span>
                  <span>·</span>
                  <span>{(r.play_count as number).toLocaleString()}{ko ? "회 진행" : " plays"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
