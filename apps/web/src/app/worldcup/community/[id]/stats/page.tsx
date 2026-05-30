import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { EmbedCodeButton } from "./EmbedCodeButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Earprint" };
  const sql = getSql();
  const rows = await sql`SELECT title FROM community_worldcups WHERE id = ${id}`;
  return { title: `${(rows[0]?.title as string) || "Worldcup"} — Stats` };
}

/**
 * Stats page for a community worldcup. Shows per-item
 * appearance / win / champion counts so the user can see which
 * videos are actually winning over time. No sign-in gate — same
 * share-first stance as the play page.
 */
export default async function CommunityStats({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = getSql();
  const [wc] = await sql`
    SELECT id, title, play_count FROM community_worldcups WHERE id = ${id}`;
  if (!wc) notFound();

  const items = await sql`
    SELECT position, yt_video_id, title, subtitle, thumbnail_url,
           appearance_count, win_count, champion_count
    FROM community_worldcup_items
    WHERE worldcup_id = ${id}
    ORDER BY champion_count DESC, win_count DESC, position`;

  const locale = await getLocale();
  const t = worldcupDict(locale);
  const totalPlays = wc.play_count as number;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <Link
          href={`/worldcup/community/${id}`}
          className="text-xs text-neutral-500 hover:text-white"
        >
          ← {t.statsPlayAgain}
        </Link>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">{wc.title as string}</h1>
        <p className="text-xs text-neutral-500">
          {totalPlays.toLocaleString()} {t.statsPlaysSoFar}
        </p>
        <EmbedCodeButton worldcupId={id} locale={locale} />
      </header>

      {totalPlays === 0 ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
          {t.statsNoPlays}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it, i) => {
            const champCount = it.champion_count as number;
            const winCount = it.win_count as number;
            const appearCount = it.appearance_count as number;
            const championRate =
              totalPlays > 0 ? Math.round((champCount / totalPlays) * 100) : 0;
            // Win rate is meaningful per appearance, not per play.
            const winRate =
              appearCount > 0 ? Math.round((winCount / appearCount) * 100) : 0;
            return (
              <li
                key={it.position as number}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <span className="w-6 shrink-0 text-right text-xs text-neutral-500 tabular-nums">
                  {i + 1}
                </span>
                {it.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumbnail_url as string}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-16 shrink-0 rounded bg-neutral-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title as string}</p>
                  {it.subtitle ? (
                    <p className="truncate text-xs text-neutral-500">
                      {it.subtitle as string}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
                  <span className="font-bold text-amber-300">
                    🏆 {championRate}%
                  </span>
                  <span className="text-neutral-500">
                    {t.statsWins} {winRate}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
