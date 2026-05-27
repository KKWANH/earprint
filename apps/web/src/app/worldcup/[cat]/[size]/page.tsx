import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
import {
  getCandidates,
  WORLDCUP_SIZES,
  type WorldcupCategory,
  type WorldcupSize,
} from "@/lib/worldcup";
import { Bracket } from "../../Bracket";

// The random / forgotten modes call `ORDER BY random()` on every
// request, which only matters if the page actually re-renders each
// visit. Without this, Next would happily serve the same 32 random
// songs forever from its route cache — the "fresh shuffle every visit"
// promise dies silently. Other modes are deterministic enough that
// re-rendering is just harmless overhead.
export const dynamic = "force-dynamic";

// `liked` retained for legacy URL compatibility — the dispatcher in
// lib/worldcup.ts maps it to library-random semantics, so old bookmarks
// don't 404 but new UI never offers it.
const VALID_CATS: WorldcupCategory[] = [
  "library",
  "recent",
  "forgotten",
  "discover",
  "mix",
  "genre",
  "liked",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string; size: string }>;
}): Promise<Metadata> {
  const { cat, size } = await params;
  const t = worldcupDict(await getLocale());
  return { title: `${size}강 · ${cat} — ${t.pageTitle}` };
}

export default async function WorldcupRunner({
  params,
}: {
  params: Promise<{ cat: string; size: string }>;
}) {
  const { cat: catRaw, size: sizeRaw } = await params;
  const cat = catRaw as WorldcupCategory;
  const size = Number(sizeRaw) as WorldcupSize;

  // Strict validation: any bad URL = 404, not a try/catch swallow. Stops
  // /worldcup/foo/9999 from sneaking past server-side.
  if (!VALID_CATS.includes(cat)) notFound();
  if (!WORLDCUP_SIZES.includes(size)) notFound();
  // Genre has its own runner at /worldcup/genre/[size] (different card
  // shape). The static path takes precedence, but this guard is a
  // belt-and-braces for any edge case where Next falls through here.
  if (cat === "genre") notFound();

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

  const candidates = await getCandidates(userId, cat, size);
  if (candidates.length < 4) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12">
        <Link href="/worldcup" className="text-xs text-neutral-500 hover:text-white">
          {t.backToCategories}
        </Link>
        <p className="text-sm text-amber-300">{t.notEnough(candidates.length, 4)}</p>
      </main>
    );
  }

  // Re-roll is available only for the random-sample modes — recent /
  // discover / mix are deterministic enough that "re-roll" wouldn't
  // visibly change the bracket. Linking the same URL re-runs the server
  // component (force-dynamic above) and gets a fresh ORDER BY random()
  // sample, no JS needed.
  const canReroll = cat === "library" || cat === "forgotten" || cat === "liked";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/worldcup" className="text-xs text-neutral-500 hover:text-white">
          {t.backToCategories}
        </Link>
        {canReroll && (
          <Link
            href={`/worldcup/${cat}/${size}`}
            prefetch={false}
            className="text-xs text-emerald-300 hover:text-emerald-200 hover:underline"
          >
            {locale === "ko" ? "🎲 새로 셔플" : "🎲 Re-roll"}
          </Link>
        )}
      </div>
      <h1 className="text-lg font-semibold">
        {size}강 · {labelForCat(cat, t)}
      </h1>
      <Bracket
        locale={locale}
        initial={candidates}
        rated={0}
        likes={0}
        dislikes={0}
        category={cat}
      />
    </main>
  );
}

function labelForCat(
  cat: WorldcupCategory,
  t: ReturnType<typeof worldcupDict>,
): string {
  switch (cat) {
    case "library": return t.catLibraryLabel;
    case "recent": return t.catRecentLabel;
    case "forgotten": return t.catForgottenLabel;
    case "discover": return t.catDiscoverLabel;
    case "mix": return t.catMixLabel;
    case "genre": return t.catGenreLabel;
    case "liked": return t.catLibraryLabel; // legacy alias
  }
}
