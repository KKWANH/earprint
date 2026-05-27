import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

interface ChampionRow {
  id: string;
  category: string;
  size: number;
  pattern: string;
  champion: { artist?: string; title?: string; id?: string };
  created_at: Date;
}

async function loadChampion(id: string): Promise<ChampionRow | null> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT id::text AS id, category, size, pattern, champion, created_at
      FROM tournament_results
      WHERE id = ${id}::uuid`;
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id as string,
      category: r.category as string,
      size: r.size as number,
      pattern: r.pattern as string,
      champion: r.champion as ChampionRow["champion"],
      created_at: new Date(r.created_at as string),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await loadChampion(id);
  if (!row) return { title: "Worldcup champion — Earprint" };
  const c = row.champion;
  const subject = c.artist ? `${c.title} — ${c.artist}` : (c.title ?? c.id ?? "—");
  // OG image lives at opengraph-image.tsx adjacent to this file —
  // Next.js auto-discovers it and attaches og:image to the response.
  return {
    title: `🏆 ${subject} — Earprint`,
    description: `My ${row.size}-bracket worldcup champion on Earprint.`,
    openGraph: { title: `🏆 ${subject}`, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * Public landing page for a saved worldcup champion. Shareable URL — any
 * one with the id can see the result, but the OG image is what does the
 * actual work on Twitter / Slack / Discord previews.
 */
export default async function ChampionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await loadChampion(id);
  if (!row) notFound();
  const locale = await getLocale();
  const c = row.champion;
  const subject = c.artist ? `${c.title} — ${c.artist}` : (c.title ?? c.id ?? "—");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-900 p-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
          🏆 {locale === "ko" ? "월드컵 우승" : "World Cup champion"}
        </p>
        <h1 className="max-w-md text-3xl font-extrabold leading-tight sm:text-4xl">
          {subject}
        </h1>
        <p className="text-xs text-neutral-500">
          {row.size}강 · {row.category}
          {" "}· {row.created_at.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}
        </p>
      </div>
      <Link
        href="/worldcup"
        className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
      >
        {locale === "ko" ? "내 월드컵 시작" : "Start your own World Cup"}
      </Link>
    </main>
  );
}
