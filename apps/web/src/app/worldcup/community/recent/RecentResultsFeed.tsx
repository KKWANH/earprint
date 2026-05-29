"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * R35 — client-driven infinite scroll for the recent-results feed.
 * Renders the SSR'd initial page (50 rows) immediately, then watches
 * a sentinel <div> at the bottom via IntersectionObserver. When the
 * sentinel scrolls into view AND there's a `nextBefore` cursor, it
 * fetches the next page (20 rows) from /api/worldcup/community/recent.
 *
 * Stops fetching when the API returns `nextBefore: null` (end of
 * table) or when an explicit hard cap is hit (HARD_PAGES) to defend
 * against an accidental tight scroll loop.
 */
interface Item {
  id: string;
  finishedAt: string;
  championTitle: string;
  championSubtitle: string | null;
  thumbnailUrl: string | null;
  worldcupId: string;
  worldcupTitle: string;
  ownerHandle: string | null;
}

const HARD_PAGES = 50; // 50 × 20 = 1000 rows max in one session

function relativeTime(iso: string, ko: boolean): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return ko ? "방금" : "just now";
  if (min < 60) return ko ? `${min}분 전` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return ko ? `${hr}시간 전` : `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return ko ? `${days}일 전` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RecentResultsFeed({
  initial,
  initialNext,
  initialNextId,
  ko,
}: {
  initial: Item[];
  initialNext: string | null;
  initialNextId: string | null;
  ko: boolean;
}) {
  const [items, setItems] = useState(initial);
  // R38 — composite cursor (timestamp + id) for stable pagination.
  const [cursor, setCursor] = useState<{ before: string; id: string } | null>(
    initialNext && initialNextId
      ? { before: initialNext, id: initialNextId }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !cursor || pages >= HARD_PAGES) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/worldcup/community/recent?before=${encodeURIComponent(cursor.before)}&beforeId=${encodeURIComponent(cursor.id)}&limit=20`,
      );
      if (!res.ok) return;
      const d = (await res.json()) as {
        ok?: boolean;
        items?: Item[];
        nextBefore?: string | null;
        nextBeforeId?: string | null;
      };
      if (!d.ok || !Array.isArray(d.items)) return;
      setItems((prev) => [...prev, ...d.items!]);
      setCursor(
        d.nextBefore && d.nextBeforeId
          ? { before: d.nextBefore, id: d.nextBeforeId }
          : null,
      );
      setPages((p) => p + 1);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, pages]);

  // IntersectionObserver — fires when the sentinel scrolls into view.
  // Each fire triggers one fetch; debouncing comes from the `loading`
  // gate inside loadMore.
  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
        {ko
          ? "아직 결과가 없어요. 누군가 월드컵을 끝내면 여기에 표시됩니다."
          : "No results yet. Finished worldcups will show up here."}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((r, i) => (
          <li
            key={r.id}
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
      {/* Sentinel — IntersectionObserver triggers loadMore when
          this scrolls into view. Stays in the DOM even when cursor
          is null so the ref doesn't churn. */}
      <div ref={sentinelRef} className="flex justify-center py-6 text-xs text-neutral-500">
        {loading
          ? ko ? "더 가져오는 중…" : "Loading more…"
          : !cursor
            ? ko ? "끝까지 봤어요" : "End of feed"
            : pages >= HARD_PAGES
              ? ko ? "더 보려면 새로고침" : "Refresh to load more"
              : ""}
      </div>
    </>
  );
}
