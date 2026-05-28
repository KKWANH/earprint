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
  const ko = locale === "ko";
  // Pattern label — built-in worldcups use four pattern names; surface
  // the human label so viewers know what kind of match-up shape
  // produced the winner. Falls through to the raw value if unknown.
  const PATTERN_LABEL: Record<string, string> = ko
    ? {
        random: "🎲 무작위",
        favorites: "❤️ 최애끼리",
        opposites: "⚡ 정반대끼리",
        cross: "🔀 혼합",
      }
    : {
        random: "🎲 Random",
        favorites: "❤️ Top picks",
        opposites: "⚡ Opposites",
        cross: "🔀 Mixed",
      };
  const patternLabel = PATTERN_LABEL[row.pattern] ?? row.pattern;
  // Deep-link to YT Music search for the champion song. Same affordance
  // as the in-bracket champion view — gives a one-tap path from the
  // public landing to "like this for real".
  const ytSearchQ = c.artist
    ? `${c.artist} ${c.title ?? ""}`
    : c.title ?? "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-900 p-8 text-center sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
          🏆 {ko ? "월드컵 우승" : "World Cup champion"}
        </p>
        <h1 className="max-w-md text-3xl font-extrabold leading-tight sm:text-4xl">
          {subject}
        </h1>
        {/* Bracket metadata chips — gives the viewer context for the
            result (it wasn't a pull from thin air; this is a 16-bracket
            run on the user's recent picks with the "opposites"
            pattern, etc.). */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-neutral-300">
            {row.size}{ko ? "강" : "-slot"}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-neutral-300">
            {row.category}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-neutral-300">
            {patternLabel}
          </span>
          <span className="text-neutral-600">
            · {row.created_at.toLocaleDateString(ko ? "ko-KR" : "en-US")}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {ytSearchQ && (
          <a
            href={`https://music.youtube.com/search?q=${encodeURIComponent(ytSearchQ)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-rose-400/40 bg-rose-500/15 px-5 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
          >
            ♥ {ko ? "YT Music에서 좋아요" : "Like in YT Music ↗"}
          </a>
        )}
        <Link
          href="/worldcup"
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {ko ? "내 월드컵 시작" : "Start your own World Cup"}
        </Link>
      </div>
    </main>
  );
}
