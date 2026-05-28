"use client";

import { useEffect, useState } from "react";
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

  // R27d: capture the champion id when the bracket finishes so we
  // can render the social signal panel below. State stays null
  // until the user reaches the final pick.
  const [championId, setChampionId] = useState<string | null>(null);

  return (
    <>
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
          setChampionId(champion.id);
        }}
      />
      {championId && (
        <ChampionSocialPanel
          worldcupId={worldcupId}
          itemId={championId}
          locale={locale}
        />
      )}
    </>
  );
}

/**
 * Loads "how many other Earprint users have this song in their
 * library" and renders it as a small subtle line below the champion
 * view. Privacy-preserving — count only, no names.
 *
 * Hidden when the count is zero (no other fan would just be a
 * deflating "0 others" line) so the panel only appears when there's
 * actually a social signal to celebrate.
 */
function ChampionSocialPanel({
  worldcupId,
  itemId,
  locale,
}: {
  worldcupId: string;
  itemId: string;
  locale: Locale;
}) {
  const ko = locale === "ko";
  const [n, setN] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/worldcup/community/${worldcupId}/champion-social?itemId=${encodeURIComponent(itemId)}`,
        );
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as { ok?: boolean; otherFans?: number };
        if (cancelled) return;
        setN(d.otherFans ?? 0);
      } catch {
        /* keep n null — panel hides */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldcupId, itemId]);

  if (!loaded || n == null || n === 0) return null;
  return (
    <div className="mx-auto mt-2 flex w-full max-w-sm items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-200">
      <span aria-hidden>👥</span>
      <span>
        {ko
          ? `다른 ${n.toLocaleString()}명의 Earprint 유저도 이 곡을 좋아해요`
          : `${n.toLocaleString()} other Earprint user${n === 1 ? "" : "s"} also ${n === 1 ? "has" : "have"} this in their library`}
      </span>
    </div>
  );
}
