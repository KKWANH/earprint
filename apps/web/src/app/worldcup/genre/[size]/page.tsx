import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
import {
  getGenreCandidates,
  WORLDCUP_SIZES,
  type WorldcupSize,
} from "@/lib/worldcup";
import { GenreBracket } from "../../GenreBracket";

// getGenreCandidates draws 3 random sample tracks per genre — pin the
// route to per-request rendering so a re-roll actually re-samples
// instead of serving Next's cached response.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ size: string }>;
}): Promise<Metadata> {
  const { size } = await params;
  const t = worldcupDict(await getLocale());
  return { title: `${size}강 · 장르 — ${t.pageTitle}` };
}

/** Genre worldcup runner. The card UI is different from track brackets
 *  (no cover, no preview — just genre name + sample tracks + colour
 *  swatch), so this lives in its own route rather than sharing the
 *  /worldcup/[cat]/[size] dynamic. */
export default async function WorldcupGenre({
  params,
}: {
  params: Promise<{ size: string }>;
}) {
  const { size: sizeRaw } = await params;
  const size = Number(sizeRaw) as WorldcupSize;
  if (!WORLDCUP_SIZES.includes(size)) notFound();

  const locale = await getLocale();
  const t = worldcupDict(locale);

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-sm text-neutral-400">
        Sign in first.
      </main>
    );
  }
  const { userId } = await requireOnboarded();

  const genres = await getGenreCandidates(userId, size);
  if (genres.length < 4) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12">
        <Link href="/worldcup" className="text-xs text-neutral-500 hover:text-white">
          {t.backToCategories}
        </Link>
        <p className="text-sm text-amber-300">{t.notEnough(genres.length, 4)}</p>
        <p className="text-xs text-neutral-500">
          {locale === "ko"
            ? "장르 토너먼트는 라이브러리에 곡 분석이 충분히 끝난 뒤에 의미가 있습니다. /library 에서 분석을 마저 돌려 보세요."
            : "Genre brackets only work once enough of your library has been analysed. Finish the analysis on /library first."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/worldcup" className="text-xs text-neutral-500 hover:text-white">
        {t.backToCategories}
      </Link>
      <h1 className="text-lg font-semibold">
        {genres.length}강 · {t.catGenreLabel}
      </h1>
      <GenreBracket
        locale={locale}
        initial={genres.map((g) => ({
          id: g.id,
          // Map the GenreCandidate fields onto the BracketCandidate
          // shape — the Bracket logic only needs id/score/recType, the
          // rest is consumed by GenreCard via the optional fields.
          artist: "",
          title: g.name,
          coverUrl: null,
          deezerId: null,
          score: g.count,
          recType: "genre",
          samples: g.samples,
          libraryShare: g.libraryShare,
        }))}
      />
    </main>
  );
}
