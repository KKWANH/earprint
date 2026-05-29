import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { isAdminEmail } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Cache stats — Earprint admin",
  robots: { index: false, follow: false },
};

interface CacheTableStats {
  rowCount: number;
  /** Rows generated in the last 24h. */
  last24h: number;
  /** Most recent row's generation timestamp. */
  newest: string | null;
}

/**
 * Admin overview of the various lazy-fill caches that amortise
 * Gemini / Last.fm / Deezer cost. Each section is independently
 * try/catch'd so a missing table on a fresh deploy degrades to
 * "0 rows" rather than breaking the page.
 *
 * Tables surfaced:
 *   - track_blurbs        — /recommend description global cache (R28j)
 *   - genre_info          — /genre/[name] description cache
 *   - lastfm_cache        — /me/recommend Last.fm similar-tracks cache
 *   - deezer_match        — Deezer search/track cache
 *   - yt_search_cache     — videoId-by-canonical-key cache
 *
 * The point isn't precise instrumentation — Sentry handles that.
 * This page is for "did the cache write path actually fire on the
 * last deploy?" at-a-glance debugging when Gemini billing spikes.
 */
async function loadStats(table: string): Promise<CacheTableStats> {
  const sql = getSql();
  try {
    if (table === "track_blurbs") {
      const r = await sql`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE generated_at > now() - interval '24 hours')::int AS recent,
               max(generated_at) AS newest
        FROM track_blurbs`;
      return {
        rowCount: Number(r[0]?.n ?? 0),
        last24h: Number(r[0]?.recent ?? 0),
        newest: r[0]?.newest
          ? new Date(r[0].newest as string).toISOString()
          : null,
      };
    }
    if (table === "genre_info") {
      const r = await sql`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE generated_at > now() - interval '24 hours')::int AS recent,
               max(generated_at) AS newest
        FROM genre_info`;
      return {
        rowCount: Number(r[0]?.n ?? 0),
        last24h: Number(r[0]?.recent ?? 0),
        newest: r[0]?.newest
          ? new Date(r[0].newest as string).toISOString()
          : null,
      };
    }
    if (table === "lastfm_cache") {
      const r = await sql`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS recent,
               max(created_at) AS newest
        FROM lastfm_cache`;
      return {
        rowCount: Number(r[0]?.n ?? 0),
        last24h: Number(r[0]?.recent ?? 0),
        newest: r[0]?.newest
          ? new Date(r[0].newest as string).toISOString()
          : null,
      };
    }
    if (table === "deezer_match") {
      const r = await sql`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS recent,
               max(created_at) AS newest
        FROM deezer_match`;
      return {
        rowCount: Number(r[0]?.n ?? 0),
        last24h: Number(r[0]?.recent ?? 0),
        newest: r[0]?.newest
          ? new Date(r[0].newest as string).toISOString()
          : null,
      };
    }
    if (table === "yt_search_cache") {
      const r = await sql`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS recent,
               max(created_at) AS newest
        FROM yt_search_cache`;
      return {
        rowCount: Number(r[0]?.n ?? 0),
        last24h: Number(r[0]?.recent ?? 0),
        newest: r[0]?.newest
          ? new Date(r[0].newest as string).toISOString()
          : null,
      };
    }
    if (table === "wiki_summaries") {
      // R33 — Wikipedia REST cache lives inside genre_info via the
      // wiki_* columns added in R32e. Count rows where wiki_fetched_at
      // is set; recency = within 24h. newest reflects the most recent
      // fetch.
      const r = await sql`
        SELECT count(*) FILTER (WHERE wiki_fetched_at IS NOT NULL)::int AS n,
               count(*) FILTER (WHERE wiki_fetched_at > now() - interval '24 hours')::int AS recent,
               max(wiki_fetched_at) AS newest
        FROM genre_info`;
      return {
        rowCount: Number(r[0]?.n ?? 0),
        last24h: Number(r[0]?.recent ?? 0),
        newest: r[0]?.newest
          ? new Date(r[0].newest as string).toISOString()
          : null,
      };
    }
    return { rowCount: 0, last24h: 0, newest: null };
  } catch {
    return { rowCount: 0, last24h: 0, newest: null };
  }
}

export default async function CacheAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    notFound();
  }

  const TABLES = [
    { table: "track_blurbs",     label: "Recommend descriptions (R28j)" },
    { table: "genre_info",       label: "Genre AI descriptions" },
    { table: "wiki_summaries",   label: "Wikipedia summaries (R32e)" },
    { table: "lastfm_cache",     label: "Last.fm similar/top" },
    { table: "deezer_match",     label: "Deezer search/track" },
    { table: "yt_search_cache",  label: "YT search → videoId" },
  ] as const;

  const stats = await Promise.all(
    TABLES.map(async (t) => ({
      ...t,
      stats: await loadStats(t.table),
    })),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Cache stats</h1>
        <p className="text-xs text-neutral-500">
          Lazy-fill caches that amortise external API cost. Quick check
          that writes are happening.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {stats.map(({ table, label, stats: s }) => (
          <div
            key={table}
            className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-neutral-900 p-5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">{label}</h2>
              <code className="text-[10px] text-neutral-600">{table}</code>
            </div>
            <p className="text-3xl font-extrabold tabular-nums text-emerald-300">
              {s.rowCount.toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] text-neutral-400">
              <span>
                last 24h:{" "}
                <span className="font-semibold text-sky-300">
                  +{s.last24h.toLocaleString()}
                </span>
              </span>
              {s.newest && (
                <span>
                  newest:{" "}
                  <span className="text-neutral-300">
                    {new Date(s.newest).toLocaleString("ko-KR")}
                  </span>
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      <p className="text-[11px] text-neutral-600">
        Read-only. If a 0 here looks wrong, check Cloudflare logs for
        the corresponding INSERT path. Migrations: tables not yet
        applied show as 0 / 0.
      </p>
    </main>
  );
}
