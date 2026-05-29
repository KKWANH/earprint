import type { Metadata } from "next";
import Link from "next/link";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find a creator — Earprint",
  description: "Search Earprint worldcup creators by handle",
};

/**
 * /u — creator search page. Without a handle, lists popular creators
 * (most total plays) plus a search box that filters /u?q=foo by
 * handle prefix/contains. R34.
 *
 * Anonymous-friendly. The handle = email local-part (same rule as
 * /u/[handle]); the regex-whitelist defends against an injection
 * surface even though the SQL already parametrises.
 */
interface CreatorRow {
  handle: string;
  worldcupCount: number;
  totalPlays: number;
}

async function searchCreators(q: string): Promise<CreatorRow[]> {
  const sql = getSql();
  const lc = q.toLowerCase().trim();
  // Defensive — handle inputs longer than the spec are simply truncated
  // so the SQL clause stays bounded.
  const safeQ = lc.replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  try {
    if (safeQ) {
      const rows = await sql`
        SELECT lower(split_part(u.email, '@', 1)) AS handle,
               count(w.id)::int AS worldcup_count,
               coalesce(sum(w.play_count), 0)::int AS total_plays
        FROM users u
        JOIN community_worldcups w ON w.owner_user_id = u.id
        WHERE w.visibility = 'public'
          AND lower(split_part(u.email, '@', 1)) LIKE ${`%${safeQ}%`}
        GROUP BY u.id
        ORDER BY total_plays DESC
        LIMIT 30`;
      return rows.map((r) => ({
        handle: r.handle as string,
        worldcupCount: Number(r.worldcup_count ?? 0),
        totalPlays: Number(r.total_plays ?? 0),
      }));
    }
    // No query — show top 30 creators platform-wide.
    const rows = await sql`
      SELECT lower(split_part(u.email, '@', 1)) AS handle,
             count(w.id)::int AS worldcup_count,
             coalesce(sum(w.play_count), 0)::int AS total_plays
      FROM users u
      JOIN community_worldcups w ON w.owner_user_id = u.id
      WHERE w.visibility = 'public'
      GROUP BY u.id
      ORDER BY total_plays DESC
      LIMIT 30`;
    return rows.map((r) => ({
      handle: r.handle as string,
      worldcupCount: Number(r.worldcup_count ?? 0),
      totalPlays: Number(r.total_plays ?? 0),
    }));
  } catch {
    return [];
  }
}

export default async function CreatorSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 30);
  const rows = await searchCreators(q);
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
          {ko ? "메이커 찾기" : "Find a creator"}
        </h1>
        <p className="text-sm text-neutral-400">
          {ko
            ? "월드컵을 만든 사람을 핸들로 검색하세요."
            : "Search worldcup creators by their handle."}
        </p>
      </header>
      <form method="GET" action="/u" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={ko ? "핸들 검색…" : "Search handle…"}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
        >
          {ko ? "검색" : "Search"}
        </button>
      </form>

      <p className="text-xs text-neutral-500">
        {q
          ? ko
            ? `"${q}" 검색 결과 ${rows.length}명`
            : `${rows.length} match${rows.length === 1 ? "" : "es"} for "${q}"`
          : ko
            ? "인기 메이커 TOP 30"
            : "Top 30 creators"}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
          {q
            ? ko ? "검색 결과 없음." : "No matches."
            : ko ? "아직 메이커가 없어요." : "No creators yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.handle}>
              <Link
                href={`/u/${encodeURIComponent(r.handle)}`}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-sky-500/40 hover:bg-sky-500/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sm font-bold text-sky-200">
                  {r.handle[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">@{r.handle}</p>
                  <p className="text-[11px] text-neutral-500">
                    {r.worldcupCount}
                    {ko ? "개 월드컵 · " : " worldcups · "}
                    {r.totalPlays.toLocaleString()}
                    {ko ? "회 진행" : " plays"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
