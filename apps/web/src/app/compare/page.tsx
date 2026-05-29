import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getLibraryStats } from "@/lib/library";
import { getLocale } from "@/lib/i18n-server";
import { compareDict } from "@/lib/i18n/compare";
import { compareTaste, type TasteVector } from "@/lib/tasteCompare";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare taste — Earprint",
  robots: { index: false, follow: false },
};

/**
 * /compare?with=<shareId> — taste overlap between the signed-in user
 * and the owner of a PUBLIC taste share (shareId). Consent model:
 * the target must have published a share link (taste_profiles.share_id),
 * so we never expose someone's taste without their opt-in. This is
 * why we key on shareId, not /u/[handle] — a worldcup creator hasn't
 * necessarily consented to expose their listening taste.
 *
 * Both sides go through getLibraryStats; the overlap math lives in the
 * pure (tested) compareTaste(). The page just renders the result.
 */
function toVector(stats: Awaited<ReturnType<typeof getLibraryStats>>): TasteVector {
  return {
    genres: stats.topGenres.map((g) => ({ name: g.name, count: g.count })),
    artists: stats.topArtists.map((a) => ({ name: a.name, count: a.count })),
    audioFeel: stats.audioFeel
      ? {
          energy: stats.audioFeel.energy,
          tempo: stats.audioFeel.tempo,
          acousticness: stats.audioFeel.acousticness,
        }
      : null,
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const locale = await getLocale();
  const t = compareDict(locale);
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/compare" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.signInGoogle}
          </button>
        </form>
      </main>
    );
  }
  const { userId } = await requireOnboarded();
  const sp = await searchParams;
  const withShare = (sp.with ?? "").trim();

  // No target yet — show the "paste a share link" entry form.
  if (!withShare) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-neutral-400">{t.entryBody}</p>
        </header>
        <form method="GET" action="/compare" className="flex flex-col gap-2">
          <input
            type="text"
            name="with"
            placeholder={t.sharePlaceholder}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            {t.compare}
          </button>
        </form>
        <p className="text-xs text-neutral-600">{t.makeOwnShare}</p>
      </main>
    );
  }

  // Accept either a bare share id or a full /s/<id> URL.
  const shareId =
    withShare.match(/\/s\/([A-Za-z0-9_-]+)/)?.[1] ??
    withShare.replace(/[^A-Za-z0-9_-]/g, "");

  const sql = getSql();
  let targetUserId: string | null = null;
  try {
    const rows = await sql`
      SELECT user_id::text AS user_id
      FROM taste_profiles WHERE share_id = ${shareId} LIMIT 1`;
    targetUserId = (rows[0]?.user_id as string | undefined) ?? null;
  } catch {
    targetUserId = null;
  }

  if (!targetUserId) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{t.shareNotFound}</h1>
        <p className="text-sm text-neutral-400">{t.shareNotFoundBody}</p>
        <Link href="/compare" className="text-sm text-emerald-300 hover:underline">
          {t.tryAgain}
        </Link>
      </main>
    );
  }

  if (targetUserId === userId) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{t.thatsYou}</h1>
        <p className="text-sm text-neutral-400">{t.thatsYouBody}</p>
        <Link href="/compare" className="text-sm text-emerald-300 hover:underline">
          {t.compareSomeoneElse}
        </Link>
      </main>
    );
  }

  const [mine, theirs] = await Promise.all([
    getLibraryStats(userId),
    getLibraryStats(targetUserId),
  ]);
  const result = compareTaste(toVector(mine), toVector(theirs));
  const pct = Math.round(result.score * 100);

  const tierEmoji: Record<typeof result.tier, string> = {
    twin: "👯",
    close: "🤝",
    some: "🎚",
    distant: "🌗",
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/compare" className="text-xs text-neutral-500 hover:text-white">
        ← {t.compareSomeoneElseShort}
      </Link>

      <section className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 p-8 text-center">
        <span className="text-5xl">{tierEmoji[result.tier]}</span>
        <p className="text-4xl font-extrabold text-emerald-300">{pct}%</p>
        <p className="text-lg font-bold">{t.tier[result.tier]}</p>
        <p className="text-xs text-neutral-500">
          {t.breakdown(
            Math.round(result.artistJaccard * 100),
            Math.round(result.genreJaccard * 100),
          )}
          {result.feelSimilarity != null &&
            t.soundSuffix(Math.round(result.feelSimilarity * 100))}
        </p>
      </section>

      {result.sharedArtists.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold">{t.sharedArtistsTitle}</h2>
          <div className="flex flex-wrap gap-1.5">
            {result.sharedArtists.map((a) => (
              <Link
                key={a}
                href={`/artist/${encodeURIComponent(a)}`}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs capitalize text-emerald-100 hover:bg-emerald-500/20"
              >
                {a}
              </Link>
            ))}
          </div>
        </section>
      )}

      {result.sharedGenres.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-sm font-semibold">{t.sharedGenresTitle}</h2>
          <div className="flex flex-wrap gap-1.5">
            {result.sharedGenres.map((g) => (
              <Link
                key={g}
                href={`/genre/${encodeURIComponent(g)}`}
                className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs capitalize text-indigo-100 hover:bg-indigo-500/20"
              >
                {g}
              </Link>
            ))}
          </div>
        </section>
      )}

      {result.sharedArtists.length === 0 && result.sharedGenres.length === 0 && (
        <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
          {t.noOverlap}
        </p>
      )}
    </main>
  );
}
