import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";

interface ReplayCard {
  id?: string;
  artist?: string;
  title?: string;
  coverUrl?: string | null;
}
interface PairOutcome {
  round: number;
  left: ReplayCard;
  right: ReplayCard;
  winnerSide: "left" | "right";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Bracket replay — Earprint`,
    description: `Full bracket replay for worldcup ${id.slice(0, 6)}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Replay the full bracket path of a saved built-in worldcup. Reads
 * tournament_results.bracket_path (JSONB array of per-pair outcomes
 * written by the Bracket runner at champion-save time). When the
 * column is missing or the row pre-dates the replay schema, we fall
 * back to "champion only" with a small note.
 *
 * Layout: one section per round, each showing every pair with the
 * loser side struck-through. No interactivity — this is a postmortem
 * view, not a playable bracket.
 */
export default async function ChampionReplay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const sql = getSql();
  // bracket_path may not exist on legacy schemas — fall back to a
  // bracket-path-less SELECT and render the "no replay" state.
  let row;
  try {
    const rows = await sql`
      SELECT id::text AS id, category, size, pattern, champion, bracket_path, created_at
      FROM tournament_results WHERE id = ${id}::uuid`;
    row = rows[0];
  } catch {
    const rows = await sql`
      SELECT id::text AS id, category, size, pattern, champion, NULL AS bracket_path, created_at
      FROM tournament_results WHERE id = ${id}::uuid`;
    row = rows[0];
  }
  if (!row) notFound();

  const locale = await getLocale();
  const t = worldcupDict(locale);
  const path = (row.bracket_path as PairOutcome[] | null) ?? null;
  // Group by round.
  const byRound = new Map<number, PairOutcome[]>();
  if (Array.isArray(path)) {
    for (const p of path) {
      const r = Number(p.round ?? 0);
      const arr = byRound.get(r) ?? [];
      arr.push(p);
      byRound.set(r, arr);
    }
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  const totalRounds = rounds.length;
  const roundLabel = (round: number, total: number): string => {
    const remaining = total - round;
    if (remaining <= 1) return t.replayRoundFinal;
    if (remaining === 2) return t.replayRoundSemi;
    if (remaining === 3) return t.replayRoundQuarter;
    return t.replayRoundOf(2 ** remaining);
  };

  const champ = row.champion as ReplayCard;
  const champSubject = champ.artist
    ? `${champ.title} — ${champ.artist}`
    : champ.title ?? "—";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <Link
          href={`/worldcup/champion/${id}`}
          className="text-xs text-neutral-500 hover:text-white"
        >
          ← {t.replayChampionPage}
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">
          🏆 {champSubject}
        </h1>
        <p className="text-xs text-neutral-500">
          {t.replayFullBracket}
        </p>
      </header>

      {path && rounds.length > 0 ? (
        <div className="flex flex-col gap-6">
          {rounds.map(([roundIdx, pairs]) => (
            <section
              key={roundIdx}
              className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                {roundLabel(roundIdx, totalRounds)}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {pairs.map((p, i) => {
                  const won = p.winnerSide;
                  const lLabel = p.left.artist
                    ? `${p.left.title} — ${p.left.artist}`
                    : p.left.title ?? "—";
                  const rLabel = p.right.artist
                    ? `${p.right.title} — ${p.right.artist}`
                    : p.right.title ?? "—";
                  return (
                    <li
                      key={`${roundIdx}-${i}`}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm sm:gap-3"
                    >
                      <span
                        className={`min-w-0 truncate ${
                          won === "left"
                            ? "font-semibold text-emerald-200"
                            : "text-neutral-500 line-through"
                        }`}
                      >
                        {lLabel}
                      </span>
                      <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-neutral-500">
                        vs
                      </span>
                      <span
                        className={`min-w-0 truncate text-right ${
                          won === "right"
                            ? "font-semibold text-emerald-200"
                            : "text-neutral-500 line-through"
                        }`}
                      >
                        {rLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
          {t.replayNoLog}
        </p>
      )}
    </main>
  );
}
