import type { Metadata } from "next";
import Link from "next/link";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { RecentResultsFeed } from "./RecentResultsFeed";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Recent results — Earprint Community Worldcups",
    description: "Live feed of recent community worldcup champions",
  };
}

interface FeedItem {
  id: string;
  finishedAt: string;
  championTitle: string;
  championSubtitle: string | null;
  thumbnailUrl: string | null;
  worldcupId: string;
  worldcupTitle: string;
  ownerHandle: string | null;
}

const INITIAL_LIMIT = 30;

/**
 * /worldcup/community/recent — SSR first page + client-side infinite
 * scroll (R35). Server pulls 30 most-recent finishes; the client
 * component RecentResultsFeed handles cursor-based pagination via
 * /api/worldcup/community/recent.
 */
async function loadInitial(): Promise<{
  items: FeedItem[];
  nextBefore: string | null;
  nextBeforeId: string | null;
}> {
  const sql = getSql();
  try {
    // R38 — id selected + (finished_at, id) ordering to match the
    // composite-cursor pagination endpoint.
    const rows = await sql`
      SELECT f.id::text AS id, f.finished_at,
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
      ORDER BY f.finished_at DESC, f.id DESC
      LIMIT ${INITIAL_LIMIT}`;
    const items: FeedItem[] = rows.map((r) => ({
      id: r.id as string,
      finishedAt: new Date(r.finished_at as string).toISOString(),
      championTitle: r.champion_title as string,
      championSubtitle: (r.champion_subtitle as string | null) ?? null,
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      worldcupId: r.worldcup_id as string,
      worldcupTitle: r.worldcup_title as string,
      ownerHandle:
        (r.owner_email as string | null)?.split("@")[0]?.toLowerCase() ?? null,
    }));
    const last = items[items.length - 1];
    const full = items.length === INITIAL_LIMIT;
    return {
      items,
      nextBefore: full ? last?.finishedAt ?? null : null,
      nextBeforeId: full ? last?.id ?? null : null,
    };
  } catch {
    return { items: [], nextBefore: null, nextBeforeId: null };
  }
}

export default async function RecentResults() {
  const { items, nextBefore, nextBeforeId } = await loadInitial();
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
            ? "방금 끝난 커뮤니티 월드컵의 우승곡 라이브 피드 (스크롤로 더 보기)."
            : "Live feed of the most recent community worldcup champions (scroll to load more)."}
        </p>
      </header>
      <RecentResultsFeed
        initial={items}
        initialNext={nextBefore}
        initialNextId={nextBeforeId}
        ko={ko}
      />
    </main>
  );
}
