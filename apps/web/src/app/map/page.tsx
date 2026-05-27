import type { Metadata } from "next";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getArtistMap, getGhostArtists } from "@/lib/artistMap";
import { getLocale } from "@/lib/i18n-server";
import { mapDict } from "@/lib/i18n/map";
import { LikesDisclaimer } from "@/components/LikesDisclaimer";
import { ArtistMap } from "./ArtistMap";

export async function generateMetadata(): Promise<Metadata> {
  const t = mapDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

export default async function MapPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = mapDict(locale);
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/map" });
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
  const { getSql } = await import("@/lib/db");
  const sql = getSql();
  const [data, shareRow] = await Promise.all([
    getArtistMap(userId),
    sql`SELECT share_id FROM taste_profiles WHERE user_id = ${userId}`,
  ]);
  const ghosts =
    data.artists.length > 0 ? await getGhostArtists(userId, data.artists) : [];
  // share_id only exists for users who've run an AI analysis. When
  // present we pass it down so the share menu can offer the iframe-
  // embed option (which uses the same share_id to load the embed
  // page anonymously).
  const shareId = (shareRow[0]?.share_id as string | undefined) ?? null;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-bold">{t.pageTitle}</h1>
          <p className="text-xs text-neutral-500">
            {t.likedArtists(data.artists.length)}
            {ghosts.length > 0 && t.ghostSuffix(ghosts.length)}
            {t.subtitleTail}
          </p>
        </div>
        <LikesDisclaimer locale={locale} />
      </header>

      {data.artists.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-500">
          {t.emptyState}
        </div>
      ) : (
        <ArtistMap data={data} ghosts={ghosts} locale={locale} shareId={shareId} />
      )}
    </main>
  );
}
