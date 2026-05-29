import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";

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
  const t = worldcupDict(locale);
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
            ← {t.listBackHome}
          </Link>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {t.listTitle}
          </h1>
          {/* R36 — unified active-filters bar. Each active filter
              (tag, creator, q) gets its own chip with an inline ✕
              that removes JUST that filter (others stay). Plus a
              'Clear all' link when 2+ filters are active. */}
          {(tag || creatorHandle || qRaw) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {(() => {
                const link = (
                  drop: "tag" | "creator" | "q",
                ): string => {
                  const qp = new URLSearchParams();
                  if (mode !== "popular") qp.set("sort", mode);
                  if (tag && drop !== "tag") qp.set("tag", tag);
                  if (creatorHandle && drop !== "creator")
                    qp.set("creator", creatorHandle);
                  if (qRaw && drop !== "q") qp.set("q", qRaw);
                  const qs = qp.toString();
                  return qs
                    ? `/worldcup/community?${qs}`
                    : "/worldcup/community";
                };
                const activeCount = [tag, creatorHandle, qRaw].filter(Boolean).length;
                return (
                  <>
                    {tag && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                        #{tag}
                        <Link
                          href={link("tag")}
                          className="text-emerald-300 hover:text-white"
                          aria-label="remove tag filter"
                        >
                          ✕
                        </Link>
                      </span>
                    )}
                    {creatorHandle && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-200">
                        @{creatorHandle}
                        <Link
                          href={link("creator")}
                          className="text-sky-300 hover:text-white"
                          aria-label="remove creator filter"
                        >
                          ✕
                        </Link>
                      </span>
                    )}
                    {qRaw && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
                        {t.listSearchChip(qRaw)}
                        <Link
                          href={link("q")}
                          className="text-amber-300 hover:text-white"
                          aria-label="remove search filter"
                        >
                          ✕
                        </Link>
                      </span>
                    )}
                    {activeCount > 1 && (
                      <Link
                        href="/worldcup/community"
                        className="text-neutral-500 hover:text-white"
                      >
                        {t.listClearAll}
                      </Link>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          <p className="mt-1 text-sm text-neutral-400">
            {t.listIntro}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/worldcup/community/recent"
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            {t.listRecent}
          </Link>
          <Link
            href="/worldcup/community/create"
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            {t.listCreate}
          </Link>
        </div>
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
          placeholder={t.listSearchPlaceholder}
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
            {t.listClear}
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
            { id: "popular", label: t.listSortPopular },
            { id: "trending", label: t.listSortTrending },
            { id: "new", label: t.listSortNew },
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
        <div className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
          {qRaw ? (
            <>
              <p>
                {t.listNoMatches(qRaw)}
              </p>
              <Link
                href={`/worldcup/community/create?tag=${encodeURIComponent(qRaw.toLowerCase())}`}
                className="self-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                {t.listBeFirstWithQuery(qRaw)}
              </Link>
            </>
          ) : (
            <p>
              {t.listEmpty}
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id as string}>
              <Link
                href={`/worldcup/community/${r.id as string}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
              >
                <h2 className="text-base font-semibold">
                  {highlight(r.title as string, q)}
                </h2>
                {r.description ? (
                  <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                    {highlight(r.description as string, q)}
                  </p>
                ) : null}
                {(r.tags ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(r.tags ?? []).slice(0, 5).map((tg) => {
                      const tagMatches = q && tg.toLowerCase().includes(q);
                      return (
                        <span
                          key={tg}
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            tagMatches
                              ? "bg-emerald-500/30 text-emerald-100"
                              : "bg-white/5 text-neutral-400"
                          }`}
                        >
                          #{tg}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                  <span>{t.listItemCount(r.item_count as number)}</span>
                  <span>·</span>
                  <span>{t.listItemPlays(r.play_count as number)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * R31c — case-insensitive search-term highlighter. Wraps every
 * match of `term` inside `text` in an emerald <mark> span. When
 * `term` is empty (no search active) returns the original string
 * verbatim so non-search renders pay zero cost.
 *
 * Escapes regex meta-chars in `term` so a user typing "(" / "$" /
 * "." doesn't blow up the splitter. The result is React children
 * (strings + spans), safe to render inline.
 */
function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === term.toLowerCase() ? (
      <mark
        key={i}
        className="rounded bg-emerald-500/30 px-0.5 text-emerald-100"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
