"use client";

import { useState } from "react";
import { genreHue } from "@/lib/forceGraph";
import type { Rec } from "./Bracket";

/**
 * Card for the genre-favorite worldcup. Different shape from BracketCard
 * — no cover image, instead a coloured gradient + 3 sample tracks from
 * the user's own library so the choice ("indie sleaze vs city pop") has
 * concrete anchors instead of being abstract.
 *
 * Sample ▶ button: opens an inline YouTube iframe AT THE TOP OF THE
 * CARD instead of the previous "send the user to a new tab" pattern,
 * which broke worldcup flow (testers reported: "유튜브 뮤직 검색이
 * 띄워지는데 좀 불편하다"). Lookup goes through /api/recommend/yt-search
 * (Data API search → videoId, cached). Lazy: nothing fires until the
 * user actually clicks ▶, so the bracket-runner pre-fetch cost stays
 * the same as before.
 *
 * Click anywhere on the card BODY (not the iframe / sample buttons) to
 * pick that genre and advance the bracket.
 */
export function GenreCard({
  rec,
  onPick,
}: {
  rec: Rec;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  // index of the sample currently embedded inline (null = nothing
  // playing, gradient cover visible). Resolved video ids are cached
  // per-sample in `videoIds` so re-clicking the same row is instant.
  const [activeSample, setActiveSample] = useState<number | null>(null);
  const [videoIds, setVideoIds] = useState<Record<number, string | null>>({});
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  const hue = genreHue(rec.id);
  const samples = rec.samples ?? [];

  async function playSample(i: number, sample: { artist: string; title: string }) {
    // Already resolved + already showing → toggle off (a second click
    // closes the player so the user can see the gradient cover again).
    if (activeSample === i && videoIds[i]) {
      setActiveSample(null);
      return;
    }
    // Have a cached video id → just swap in the iframe.
    if (videoIds[i] !== undefined) {
      setActiveSample(i);
      return;
    }
    // First click for this sample → fetch then show.
    setLoadingIdx(i);
    try {
      const res = await fetch("/api/recommend/yt-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: sample.artist, title: sample.title }),
      });
      const data: { videoId?: string | null } = res.ok ? await res.json() : {};
      const id = data.videoId ?? null;
      setVideoIds((m) => ({ ...m, [i]: id }));
      if (id) setActiveSample(i);
    } catch {
      setVideoIds((m) => ({ ...m, [i]: null }));
    } finally {
      setLoadingIdx(null);
    }
  }

  const activeVideoId =
    activeSample != null ? videoIds[activeSample] ?? null : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onPick();
      }}
      className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition-all ${
        hover
          ? "border-emerald-500/60 bg-emerald-500/5"
          : "border-white/10 bg-neutral-900"
      }`}
      style={
        hover
          ? undefined
          : {
              background: `linear-gradient(135deg, hsl(${hue} 55% 22%) 0%, hsl(${
                (hue + 50) % 360
              } 45% 8%) 100%)`,
            }
      }
    >
      {/* Inline YouTube embed — only mounted when a sample is active.
          stopPropagation on click so interacting with the player
          (pause, scrub, volume) doesn't vote the card. */}
      {activeVideoId && (
        <div
          className="overflow-hidden rounded-lg ring-1 ring-white/15"
          onClick={(e) => e.stopPropagation()}
        >
          <iframe
            key={activeVideoId}
            src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&modestbranding=1`}
            title="YouTube preview"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold capitalize leading-tight sm:text-2xl">
          {rec.id}
        </h3>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
          {rec.libraryShare != null && rec.libraryShare > 0 && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/85">
              {(rec.libraryShare * 100).toFixed(rec.libraryShare < 0.05 ? 1 : 0)}
              % of library
            </span>
          )}
          {rec.score != null && (
            <span className="text-[10px] text-white/55">
              {Math.round(rec.score)} tracks
            </span>
          )}
        </div>
      </div>
      {samples.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[11px] leading-snug text-white/65">
          {samples.slice(0, 3).map((s, i) => {
            const isActive = activeSample === i && activeVideoId;
            const isLoading = loadingIdx === i;
            // When videoIds[i] is explicitly null we already tried and
            // got nothing — fall back to a YT search link so the row
            // isn't a dead button.
            const failedLookup = videoIds[i] === null;
            const ytSearch = `https://music.youtube.com/search?q=${encodeURIComponent(
              `${s.artist} ${s.title}`,
            )}`;
            return (
              <li key={i} className="flex items-baseline gap-1.5">
                {failedLookup ? (
                  // Lookup failed (no API key / quota / nothing found)
                  // — keep the original "open YT search" affordance so
                  // the user can still hear the track.
                  <a
                    href={ytSearch}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-rose-200 hover:bg-rose-500/30 hover:text-white"
                    title="YouTube Music search"
                  >
                    ▶ ↗
                  </a>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void playSample(i, s);
                    }}
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] transition-colors ${
                      isActive
                        ? "bg-rose-500/70 text-white"
                        : "bg-white/10 text-rose-200 hover:bg-rose-500/30 hover:text-white"
                    } ${isLoading ? "animate-pulse" : ""}`}
                    title={isActive ? "Hide preview" : "Play inline"}
                    disabled={isLoading}
                  >
                    {isActive ? "■" : isLoading ? "…" : "▶"}
                  </button>
                )}
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-white/85">{s.title}</span>
                  <span className="text-white/40"> · {s.artist}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-white/50">No sample tracks in this genre yet.</p>
      )}
    </div>
  );
}
