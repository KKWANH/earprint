import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getExcludedArtists } from "@/lib/library";
import { getLocale } from "@/lib/i18n-server";
import { genresIndexDict } from "@/lib/i18n/genresIndex";

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

/**
 * The full alphabet of genres — every tag, no LIMIT. /library shows the top
 * 14; this page is the "see them all" companion.
 */
export default async function GenresIndexPage() {
  const locale = await getLocale();
  const t = genresIndexDict(locale);
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
  const genres = await getAllGenres(userId);
  const max = Math.max(1, ...genres.map((g) => g.count));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/library" className="text-xs text-neutral-500 hover:text-white">
        {t.back}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="text-sm text-neutral-400">{t.subtitle(genres.length)}</p>
      </header>

      {genres.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.empty}</p>
      ) : (
        <section className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          {genres.map((g) => (
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
      )}
    </main>
  );
}
