import Link from "next/link";
import { getSql } from "@/lib/db";
import type { Locale } from "@/lib/i18n";

interface HistoryRow {
  id: string;
  category: string;
  size: number;
  pattern: string;
  champion: { artist?: string; title?: string; id?: string };
  created_at: Date;
}

/**
 * Lists the user's recent worldcup champions. Empty state nudges them
 * toward /worldcup so the section isn't just a sad blank box. Read-only
 * — deletion of individual rows isn't surfaced (the "Delete account"
 * button at the bottom of /account wipes everything anyway).
 *
 * Server Component — fetches inline. Pulled out of /account/page.tsx
 * mostly to keep that file's render tree shallow.
 */
export async function WorldcupHistorySection({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const sql = getSql();
  let rows: HistoryRow[] = [];
  try {
    const fetched = await sql`
      SELECT id::text   AS id,
             category,
             size,
             pattern,
             champion,
             created_at
      FROM tournament_results
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
      LIMIT 8`;
    rows = fetched.map((r) => ({
      id: r.id as string,
      category: r.category as string,
      size: r.size as number,
      pattern: r.pattern as string,
      champion: r.champion as HistoryRow["champion"],
      created_at: new Date(r.created_at as string),
    }));
  } catch {
    // Table missing (migration not run yet) → render nothing. The
    // section's just additive; no need to scream a 500 on the account
    // page over a missing optional history table.
    return null;
  }

  const title = locale === "ko" ? "월드컵 기록" : "World Cup history";
  const emptyText =
    locale === "ko"
      ? "토너먼트를 진행한 적이 없습니다. /worldcup 에서 시작해 보세요."
      : "No tournaments yet. Head to /worldcup to start one.";
  const lang = locale === "ko" ? "ko-KR" : "en-US";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <Link
          href="/worldcup"
          className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
        >
          /worldcup →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <HistoryItem key={r.id} row={r} lang={lang} locale={locale} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryItem({
  row,
  lang,
  locale,
}: {
  row: HistoryRow;
  lang: string;
  locale: Locale;
}) {
  // Champion shape differs by category (track has artist+title, genre
  // has only id+title). Render whichever fields are populated.
  const subject = row.champion.artist
    ? `${row.champion.title ?? "—"} · ${row.champion.artist}`
    : row.champion.title ?? row.champion.id ?? "—";
  const catLabel = labelForCategory(row.category, locale);
  return (
    <li className="flex items-baseline gap-3 border-b border-neutral-800/60 py-1.5 text-sm last:border-0">
      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
        {row.size}강
      </span>
      <span className="shrink-0 text-xs text-neutral-500">{catLabel}</span>
      <span className="min-w-0 flex-1 truncate text-neutral-200">{subject}</span>
      <span className="shrink-0 text-[10px] text-neutral-600">
        {row.created_at.toLocaleDateString(lang)}
      </span>
    </li>
  );
}

function labelForCategory(cat: string, locale: Locale): string {
  if (locale === "ko") {
    if (cat === "liked") return "좋아요";
    if (cat === "discover") return "취향 찾기";
    if (cat === "mix") return "섞기";
    if (cat === "genre") return "장르";
    return cat;
  }
  if (cat === "liked") return "Liked";
  if (cat === "discover") return "Discover";
  if (cat === "mix") return "Mix";
  if (cat === "genre") return "Genre";
  return cat;
}
