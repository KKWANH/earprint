import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getArtistMap, getGhostArtists } from "@/lib/artistMap";
import { getLocale } from "@/lib/i18n-server";
import { ArtistMap } from "../../ArtistMap";

/**
 * Iframe-embeddable artist map. Replaces the previous "PNG embed
 * inside an <a href=/>" pattern that surfaced as a static dead image
 * pointing at the marketing page — testers reported "확대도 안되고
 * 클릭하면 메인페이지로". This page is the same interactive ArtistMap
 * the owner sees on /map (drag, wheel-zoom, click-to-focus) but with:
 *   - no NavBar / Footer
 *   - no auth gate (looked up by share_id — same pattern as /s/[id])
 *   - a small "Open full map ↗" badge in the corner that deep-links
 *     to /map (not /) so embed viewers who want more land in the
 *     right place
 *
 * Designed for `<iframe src=".../map/embed/{shareId}" width="640"
 * height="480">`. The canvas itself manages scroll/zoom inside the
 * iframe, so the host blog doesn't need to do anything special.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  return {
    title: "Artist map — Earprint",
    description: `Interactive artist taste map · ${shareId.slice(0, 6)}`,
    // Embedded by design, so don't index — the parent /s/[shareId]
    // is the public landing.
    robots: { index: false, follow: false },
  };
}

async function loadOwnerByShare(shareId: string): Promise<string | null> {
  if (!/^[0-9a-f]{6,64}$/i.test(shareId)) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT user_id FROM taste_profiles WHERE share_id = ${shareId}`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}

export default async function ArtistMapEmbedPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const userId = await loadOwnerByShare(shareId);
  if (!userId) notFound();

  const locale = await getLocale();
  const data = await getArtistMap(userId);
  const ghosts =
    data.artists.length > 0 ? await getGhostArtists(userId, data.artists) : [];

  return (
    // Full-bleed, no chrome — designed to fit inside whatever iframe
    // the embedding blog gave it. The canvas inside ArtistMap fills
    // 100% of the available height.
    <main className="flex h-screen w-screen flex-col bg-neutral-950">
      <ArtistMap
        data={data}
        ghosts={ghosts}
        locale={locale}
      />
      {/* Corner badge — deep-links to the proper /map page (not /)
          so an embed-viewer who wants the full UX lands somewhere
          useful instead of the marketing site. target=_top so the
          link breaks out of the iframe. */}
      <Link
        href="/map"
        target="_top"
        className="pointer-events-auto absolute bottom-2 right-2 z-30 rounded-full border border-white/10 bg-black/80 px-2.5 py-1 text-[10px] font-medium text-neutral-300 backdrop-blur hover:border-emerald-500/40 hover:text-white"
      >
        Open full map ↗
      </Link>
    </main>
  );
}
