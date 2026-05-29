import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";

// R34 — searchParams + auth() both need a dynamic render. Without
// this the route was static-prerendering once with empty params
// and ignoring subsequent ?q=/sort=/page= updates.
export const dynamic = "force-dynamic";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getExcludedArtists } from "@/lib/library";
import { getLocale } from "@/lib/i18n-server";
import { genresIndexDict } from "@/lib/i18n/genresIndex";
import {
  canonicalGenreKey,
  canonicalGenreLabel,
  genreFamilyLabel,
} from "@/lib/genreDict";
import { RequestForm } from "./RequestForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = genresIndexDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

interface GenreRow {
  /** Canonical display label (variant spellings already merged). */
  name: string;
  /** Canonical key used for the /genre/[name] link + dedup. */
  key: string;
  count: number;
}

/**
 * Every genre that ever appeared in the user's library, sorted by frequency.
 *
 * R35 — only counts genres where the AI's confidence weight is ≥ 0.30.
 * The `analysis.genres` JSONB is shaped `{"k-pop": 0.85, "lofi": 0.05}`;
 * the old query iterated EVERY key regardless of weight, so a track
 * with a 0.05 weight on "shoegaze" surfaced "shoegaze" in the user's
 * list even though the AI's signal was weak. Threshold = 0.30 cuts the
 * noise floor without losing real signal.
 *
 * R37 — the JSONB stores RAW Gemini keys, so "synthpop" and
 * "synth-pop" are separate keys from different tracks. We canonicalize
 * each key through genreDict (canonicalGenreKey / canonicalGenreLabel)
 * and re-aggregate in JS so variant spellings merge into one row with
 * a summed count.
 */
const GENRE_WEIGHT_FLOOR = 0.30;

async function getAllGenres(userId: string): Promise<GenreRow[]> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);
  // R37 — guard the ::float cast with a jsonb_typeof CASE. Postgres
  // does NOT guarantee AND short-circuits, so a non-number weight
  // (a legacy string value) would otherwise throw and 500 the page.
  // CASE forces the cast to run only on actual numbers. Whole call
  // is also try/catch'd so a schema surprise degrades to "no genres"
  // rather than an error page.
  let rows: Array<{ name: string; count: number }> = [];
  try {
    rows = (await sql`
      SELECT k.key AS name, count(*)::int AS count
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      JOIN tracks t ON t.id = a.track_id
      CROSS JOIN LATERAL jsonb_each(a.genres) AS k(key, value)
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
        AND t.artist <> ALL(${excluded}::text[])
        AND (CASE WHEN jsonb_typeof(k.value) = 'number'
                  THEN (k.value)::text::float ELSE 0 END) >= ${GENRE_WEIGHT_FLOOR}
      GROUP BY k.key
      ORDER BY count DESC, k.key ASC`) as Array<{ name: string; count: number }>;
  } catch (e) {
    console.error("[genres] getAllGenres failed:", e);
    return [];
  }

  // Re-aggregate by canonical key so variant spellings merge.
  const merged = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    const raw = r.name as string;
    const cnt = r.count as number;
    const key = canonicalGenreKey(raw);
    const existing = merged.get(key);
    if (existing) {
      existing.count += cnt;
    } else {
      merged.set(key, { name: canonicalGenreLabel(raw), count: cnt });
    }
  }
  return [...merged.entries()]
    .map(([key, v]) => ({ key, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

type Sort = "count" | "alpha";

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
  searchParams: Promise<{ q?: string; sort?: string }>;
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

  const all = await getAllGenres(userId);
  // R34 — server-side filter + sort. Pagination removed at the user's
  // request: a long single list is fine when you've got fast search.
  const ql = q.toLowerCase();
  let filtered = ql ? all.filter((g) => g.name.toLowerCase().includes(ql)) : all;
  if (sort === "alpha") {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }
  const max = Math.max(1, ...filtered.map((g) => g.count));

  const buildHref = (override: Partial<{ q: string; sort: Sort }>) => {
    const qp = new URLSearchParams();
    const nextQ = override.q ?? q;
    const nextSort = override.sort ?? sort;
    if (nextQ) qp.set("q", nextQ);
    if (nextSort === "alpha") qp.set("sort", "alpha");
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
      <div className="flex flex-col gap-2">
        {/* Search box. GET form so URL is shareable. The hidden
            sort input preserves the active sort when submitting a
            new search term. */}
        <form
          method="GET"
          action="/genres"
          className="flex items-center gap-2"
        >
          {sort === "alpha" && (
            <input type="hidden" name="sort" value="alpha" />
          )}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
          >
            {t.searchSubmit}
          </button>
          {q && (
            <Link
              href={buildHref({ q: "" })}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              {t.searchClear}
            </Link>
          )}
        </form>
        {/* Sort toggle on its own row — clearer affordance, more
            tappable hit targets than crammed alongside search. */}
        <div className="flex gap-1.5">
          {(["count", "alpha"] as const).map((s) => {
            const active = sort === s;
            return (
              <Link
                key={s}
                href={buildHref({ sort: s })}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-neutral-200"
                }`}
              >
                {s === "count" ? t.sortByFrequency : t.sortAlpha}
              </Link>
            );
          })}
        </div>
      </div>

      {all.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.empty}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
          {t.noMatches(q)}
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {t.resultCount(filtered.length)}
          </p>
          {(() => {
            // R37 — group the (already-canonicalized) genres by
            // family. Unmatched long-tail genres fall into an
            // "Other" bucket at the bottom. When alpha-sorting we
            // sort families alphabetically too; for count-sort we
            // order families by their total track count desc.
            const OTHER = t.other;
            const groups = new Map<
              string,
              { label: string; items: GenreRow[]; total: number }
            >();
            for (const g of filtered) {
              const fam = genreFamilyLabel(g.key, ko ? "ko" : "en");
              const id = fam?.id ?? "__other";
              const label = fam?.label ?? OTHER;
              const grp = groups.get(id) ?? { label, items: [], total: 0 };
              grp.items.push(g);
              grp.total += g.count;
              groups.set(id, grp);
            }
            const ordered = [...groups.values()].sort((a, b) => {
              // Always push Other last.
              if (a.label === OTHER) return 1;
              if (b.label === OTHER) return -1;
              return sort === "alpha"
                ? a.label.localeCompare(b.label)
                : b.total - a.total;
            });
            return (
              <div className="flex flex-col gap-4">
                {ordered.map((grp) => (
                  <section
                    key={grp.label}
                    className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-5"
                  >
                    <h2 className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      <span>{grp.label}</span>
                      <span className="text-neutral-600">
                        {grp.items.length}
                      </span>
                    </h2>
                    {grp.items.map((g) => (
                      <div key={g.key} className="flex items-center gap-3 text-sm">
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
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* Genre feedback form — collapsed by default. Two-branch:
          "add to catalogue" vs "rerun analysis on my tracks". Rate
          limited to 3 submissions / user / day in the API. */}
      <RequestForm locale={locale} />
    </main>
  );
}
