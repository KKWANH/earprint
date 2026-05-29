import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getExcludedArtists } from "@/lib/library";
import { getLocale } from "@/lib/i18n-server";
import { genresIndexDict } from "@/lib/i18n/genresIndex";
import { RequestForm } from "./RequestForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = genresIndexDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

interface GenreRow {
  name: string;
  count: number;
}

/** Every genre that ever appeared in the user's library, sorted by frequency. */
async function getAllGenres(userId: string): Promise<GenreRow[]> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);
  const rows = await sql`
    SELECT k.key AS name, count(*)::int AS count
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    JOIN tracks t ON t.id = a.track_id
    CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
    WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
      AND t.artist <> ALL(${excluded}::text[])
    GROUP BY k.key
    ORDER BY count DESC, k.key ASC`;
  return rows.map((r) => ({ name: r.name as string, count: r.count as number }));
}

type Sort = "count" | "alpha";
const PAGE_SIZE = 50;

/**
 * The full alphabet of genres — every tag, with R33 enhancements:
 *   - text search across name (case-insensitive contains)
 *   - sort toggle (frequency desc vs alphabetical)
 *   - pagination (50/page)
 *
 * Server-side filtering keeps the rendered DOM cheap for users with
 * 300+ distinct genres. Search box is a GET form so the URL is
 * shareable / bookmarkable.
 */
export default async function GenresIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const locale = await getLocale();
  const t = genresIndexDict(locale);
  const ko = locale === "ko";
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/genres" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.loginGoogle}
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await requireOnboarded();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const sort: Sort = sp.sort === "alpha" ? "alpha" : "count";
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const all = await getAllGenres(userId);
  // R33 — server-side filter + sort. We could push this into SQL but
  // jsonb_object_keys aggregation is already the expensive part; a
  // post-filter on a <1k row array is microseconds either way.
  const ql = q.toLowerCase();
  let filtered = ql ? all.filter((g) => g.name.toLowerCase().includes(ql)) : all;
  if (sort === "alpha") {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }
  // Default sort = count desc (handled in SQL) so we don't re-sort.
  const max = Math.max(1, ...filtered.map((g) => g.count));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(pageNum, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const buildHref = (p: number, override?: Partial<{ q: string; sort: Sort }>) => {
    const qp = new URLSearchParams();
    const nextQ = override?.q ?? q;
    const nextSort = override?.sort ?? sort;
    if (nextQ) qp.set("q", nextQ);
    if (nextSort === "alpha") qp.set("sort", "alpha");
    if (p > 1) qp.set("page", String(p));
    const qs = qp.toString();
    return qs ? `/genres?${qs}` : "/genres";
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/library" className="text-xs text-neutral-500 hover:text-white">
        {t.back}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="text-sm text-neutral-400">{t.subtitle(all.length)}</p>
      </header>

      {/* R33 — controls: search GET form + sort toggle. Both
          preserve each other via querystring. */}
      <form
        method="GET"
        action="/genres"
        className="flex flex-wrap items-center gap-2"
      >
        {sort === "alpha" && <input type="hidden" name="sort" value="alpha" />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={ko ? "장르 검색…" : "Search genres…"}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
        />
        {q && (
          <Link
            href={buildHref(1, { q: "" })}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            {ko ? "지우기" : "Clear"}
          </Link>
        )}
        <div className="flex gap-1.5">
          {(["count", "alpha"] as const).map((s) => {
            const active = sort === s;
            return (
              <Link
                key={s}
                href={buildHref(1, { sort: s })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40"
                }`}
              >
                {s === "count"
                  ? ko ? "🔥 빈도순" : "🔥 By frequency"
                  : ko ? "🔤 가나다순" : "🔤 Alphabetical"}
              </Link>
            );
          })}
        </div>
      </form>

      {all.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.empty}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
          {ko ? `"${q}" 검색 결과 없음.` : `No matches for "${q}".`}
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {ko
              ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} / ${filtered.length.toLocaleString()}개`
              : `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}`}
          </p>
          <section className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            {slice.map((g) => (
              <div key={g.name} className="flex items-center gap-3 text-sm">
                <Link
                  href={`/genre/${encodeURIComponent(g.name)}`}
                  className="w-40 shrink-0 truncate text-neutral-300 hover:text-white hover:underline"
                >
                  {g.name}
                </Link>
                <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-800">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${(g.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-neutral-500">
                  {g.count}
                </span>
              </div>
            ))}
          </section>
          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-2 text-xs text-neutral-500">
              {safePage > 1 ? (
                <Link
                  href={buildHref(safePage - 1)}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 hover:text-white"
                >
                  {ko ? "← 이전" : "← Previous"}
                </Link>
              ) : (
                <span className="rounded-md border border-neutral-800 px-3 py-1.5 text-neutral-700">
                  {ko ? "← 이전" : "← Previous"}
                </span>
              )}
              <span className="tabular-nums">
                {safePage} / {totalPages}
              </span>
              {safePage < totalPages ? (
                <Link
                  href={buildHref(safePage + 1)}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 hover:text-white"
                >
                  {ko ? "다음 →" : "Next →"}
                </Link>
              ) : (
                <span className="rounded-md border border-neutral-800 px-3 py-1.5 text-neutral-700">
                  {ko ? "다음 →" : "Next →"}
                </span>
              )}
            </nav>
          )}
        </>
      )}

      {/* Genre feedback form — collapsed by default. Two-branch:
          "add to catalogue" vs "rerun analysis on my tracks". Rate
          limited to 3 submissions / user / day in the API. */}
      <RequestForm locale={locale} />
    </main>
  );
}
