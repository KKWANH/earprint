import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

/**
 * /worldcup/community/tag/[tag] — SEO-friendly canonical landing
 * page for a tag. Same data as /worldcup/community?tag=<tag> but
 * with a static URL, dedicated H1, and tag-specific OG image hint.
 *
 * Indexed and surfaced in sitemap.xml so Google can attribute "k-pop
 * worldcup" / "indie 월드컵" searches directly to this page rather
 * than the query-stringed variant (which is canonical-tagged to
 * /worldcup/community for de-dup).
 *
 * Renders the top 24 community worldcups with that tag, ordered by
 * play_count DESC. notFound() when zero match — keeps the page
 * meaningfully scoped (no empty pages getting indexed).
 */
interface Row {
  id: string;
  title: string;
  description: string | null;
  play_count: number;
  item_count: number;
  tags: string[];
}

const TAG_RE = /^[a-z0-9_-]{1,40}$/i;

async function loadForTag(tag: string): Promise<Row[]> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT w.id::text AS id, w.title, w.description, w.play_count, w.tags,
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS item_count
      FROM community_worldcups w
      WHERE w.visibility = 'public' AND ${tag} = ANY(w.tags)
      ORDER BY w.play_count DESC, w.created_at DESC
      LIMIT 24`;
    return rows as unknown as Row[];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag).toLowerCase();
  return {
    title: `#${decoded} worldcups — Earprint Community`,
    description: `Top community worldcups tagged #${decoded} — pick a winner, see the stats.`,
    alternates: {
      canonical: `https://earprint.kwanho.dev/worldcup/community/tag/${encodeURIComponent(decoded)}`,
    },
    openGraph: {
      title: `#${decoded} worldcups`,
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function TagLanding({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: raw } = await params;
  const lc = decodeURIComponent(raw).toLowerCase().trim();
  if (!TAG_RE.test(lc)) notFound();
  const rows = await loadForTag(lc);
  if (rows.length === 0) notFound();
  const locale = await getLocale();
  const ko = locale === "ko";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/worldcup/community"
        className="text-xs text-neutral-500 hover:text-white"
      >
        ← {ko ? "커뮤니티 월드컵" : "Community worldcups"}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">#{lc}</h1>
        <p className="text-sm text-neutral-400">
          {ko
            ? `이 태그가 달린 커뮤니티 월드컵 ${rows.length}개.`
            : `${rows.length} community worldcups tagged with this.`}
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/worldcup/community/${r.id}`}
              className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
            >
              <h2 className="line-clamp-1 text-sm font-semibold">{r.title}</h2>
              {r.description && (
                <p className="line-clamp-2 text-[11px] text-neutral-500">
                  {r.description}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(r.tags ?? []).slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      t === lc
                        ? "bg-emerald-500/30 text-emerald-100"
                        : "bg-white/5 text-neutral-400"
                    }`}
                  >
                    #{t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
                <span>
                  {r.item_count}
                  {ko ? "강" : "-slot"}
                </span>
                <span>·</span>
                <span>
                  {r.play_count.toLocaleString()}
                  {ko ? "회 진행" : " plays"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="self-center text-xs text-neutral-500">
        <Link
          href={`/worldcup/community?tag=${encodeURIComponent(lc)}&sort=trending`}
          className="hover:text-emerald-300"
        >
          {ko ? "정렬·필터 더 보기 →" : "More sort / filter options →"}
        </Link>
      </p>
    </main>
  );
}
