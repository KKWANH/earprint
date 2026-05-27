import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Community worldcups — Earprint" };
}

/**
 * /worldcup/community — list public UGC worldcups ordered by play
 * count. Each row shows title / item count / play count. Sign-in
 * not required to browse or play; only the create link gates on
 * sign-in.
 */
export default async function CommunityList() {
  const locale = await getLocale();
  const ko = locale === "ko";
  const sql = getSql();

  const rows = await sql`
    SELECT w.id, w.title, w.description, w.play_count, w.created_at,
           (SELECT count(*)::int FROM community_worldcup_items i
              WHERE i.worldcup_id = w.id) AS item_count
    FROM community_worldcups w
    WHERE w.visibility = 'public'
    ORDER BY w.play_count DESC, w.created_at DESC
    LIMIT 100`;

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
          <p className="mt-1 text-sm text-neutral-400">
            {ko
              ? "다른 사람이 만든 토너먼트. 누구든 플레이 가능."
              : "Tournaments other people made. Anyone can play."}
          </p>
        </div>
        <Link
          href="/worldcup/community/create"
          className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
        >
          {ko ? "+ 만들기" : "+ Create"}
        </Link>
      </header>

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
