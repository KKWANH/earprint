"use client";

import type { Locale } from "@/lib/i18n";
import { Bracket, type Rec } from "../../Bracket";

/**
 * Plays a community/UGC worldcup. Just wires the DB items into the
 * existing Bracket runner with onChampion → POST /finish to bump
 * aggregate stats. Reuses BracketCard so the YT iframe + big play
 * button + final-round amber treatment all come for free; only
 * differences are:
 *   • each item already carries its ytVideoId (no yt-search lookup)
 *   • title/subtitle come from the oEmbed payload, not Deezer
 *   • deezerId is null (no 30s preview — these are arbitrary YT
 *     videos, not music-database tracks)
 */
export interface CommunityItem {
  id: string;
  ytVideoId: string;
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
}

export function CommunityRunner({
  worldcupId,
  locale,
  items,
}: {
  worldcupId: string;
  locale: Locale;
  items: CommunityItem[];
}) {
  // Map to BracketCandidate shape. title goes in `title`, subtitle
  // (uploader / artist) into `artist` since that's the field
  // BracketCard renders below the title. coverUrl = thumbnail.
  // deezerId null → 30s preview button stays hidden; only the YT
  // embed path fires from the big centred play button.
  const initial: Rec[] = items.map((it) => ({
    id: it.id,
    artist: it.subtitle ?? "",
    title: it.title,
    coverUrl: it.thumbnail,
    deezerId: null,
    score: null,
    recType: "community",
    ytVideoId: it.ytVideoId,
  }));

  return (
    <Bracket
      initial={initial}
      rated={0}
      likes={0}
      dislikes={0}
      locale={locale}
      onChampion={(champion, winners, allItems) => {
        // Fire-and-forget: don't await, don't block the celebration
        // screen on the network. Failure just means the stats don't
        // tick for this play — no user-facing degradation.
        void fetch(`/api/worldcup/community/${worldcupId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            championItemId: champion.id,
            winnerItemIds: winners.map((w) => w.id),
            allItemIds: allItems.map((it) => it.id),
          }),
        }).catch(() => {});
      }}
    />
  );
}
