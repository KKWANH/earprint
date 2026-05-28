import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { CommunityRunner } from "../CommunityRunner";

/**
 * Iframe-embeddable community worldcup runner. Same data path as
 * /worldcup/community/[id] but with zero NavBar / Footer chrome
 * (NavBar.tsx hides itself on paths ending in `/embed`).
 *
 * Intended use: `<iframe src=".../worldcup/community/<id>/embed"
 * width="640" height="780">` dropped into a blog post / Reddit
 * markdown / etc. so the bracket plays inside the host page without
 * the user navigating away. Stats still post back to the same
 * `/finish` endpoint (anonymous-friendly + rate-limited), so plays
 * via embed also tick the community counters.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Earprint" };
  const sql = getSql();
  const rows = await sql`SELECT title FROM community_worldcups WHERE id = ${id}`;
  return {
    title: `${(rows[0]?.title as string) || "Worldcup"} — Earprint embed`,
    robots: { index: false, follow: false },
  };
}

export default async function CommunityEmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = getSql();
  const [wc] = await sql`
    SELECT id, title FROM community_worldcups WHERE id = ${id}`;
  if (!wc) notFound();
  const items = await sql`
    SELECT id, position, yt_video_id, title, subtitle, thumbnail_url
    FROM community_worldcup_items
    WHERE worldcup_id = ${id}
    ORDER BY position`;
  if (items.length < 4) notFound();
  const locale = await getLocale();

  return (
    <main className="flex min-h-screen flex-col gap-3 bg-neutral-950 px-3 py-3">
      <h1 className="line-clamp-1 text-sm font-semibold text-neutral-200">
        {wc.title as string}
      </h1>
      <CommunityRunner
        worldcupId={id}
        locale={locale}
        items={items.map((r) => ({
          id: r.id as string,
          ytVideoId: r.yt_video_id as string,
          title: r.title as string,
          subtitle: (r.subtitle as string) ?? null,
          thumbnail: (r.thumbnail_url as string) ?? null,
        }))}
      />
      <Link
        href={`/worldcup/community/${id}`}
        target="_top"
        className="self-end text-[10px] text-neutral-500 hover:text-neutral-300"
      >
        Open on Earprint ↗
      </Link>
    </main>
  );
}
