import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { CommunityRunner } from "./CommunityRunner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Earprint" };
  const sql = getSql();
  const rows = await sql`SELECT title FROM community_worldcups WHERE id = ${id}`;
  const title = (rows[0]?.title as string) || "Worldcup";
  return { title: `${title} — Earprint Worldcup` };
}

/**
 * Play page for a community-created worldcup. Anyone can play (no
 * sign-in gate) — UGC brackets are share-first. The server fetches
 * the worldcup + items once, then hands them to the client runner
 * which manages bracket state and reports the champion via the
 * onChampion callback.
 */
export default async function CommunityPlay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = getSql();
  const [wc] = await sql`
    SELECT id, title, description, visibility, play_count
    FROM community_worldcups WHERE id = ${id}`;
  if (!wc) notFound();

  const items = await sql`
    SELECT id, position, yt_video_id, title, subtitle, thumbnail_url
    FROM community_worldcup_items
    WHERE worldcup_id = ${id}
    ORDER BY position`;
  if (items.length < 4) notFound();

  const locale = await getLocale();
  const ko = locale === "ko";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <Link
          href="/worldcup/community"
          className="text-xs text-neutral-500 hover:text-white"
        >
          ← {ko ? "커뮤니티 월드컵" : "Community worldcups"}
        </Link>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">{wc.title as string}</h1>
        {wc.description ? (
          <p className="text-sm text-neutral-400">{wc.description as string}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-neutral-600">
          {items.length}-{ko ? "인 토너먼트 · " : "slot tournament · "}
          {(wc.play_count as number).toLocaleString()} {ko ? "회 진행" : "plays"}
        </p>
      </header>
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
      <p className="text-xs text-neutral-500">
        <Link href={`/worldcup/community/${id}/stats`} className="hover:text-white hover:underline">
          {ko ? "통계 보기 →" : "View stats →"}
        </Link>
      </p>
    </main>
  );
}
