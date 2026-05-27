"use client";

import { useState } from "react";
import { genreHue } from "@/lib/forceGraph";
import type { Rec } from "./Bracket";

/**
 * Card for the genre-favorite worldcup. Different shape from BracketCard
 * (no cover image, no Deezer preview, no YouTube embed — just the
 * genre name big + a colour swatch + a few representative tracks from
 * the user's own library so the choice "indie sleaze vs city pop"
 * has something concrete to anchor against).
 *
 * Click anywhere on the card to pick it; sample tracks are decorative
 * (not links — we don't want a stray click to navigate away mid-bracket).
 */
export function GenreCard({
  rec,
  onPick,
}: {
  rec: Rec;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const hue = genreHue(rec.id);
  const samples = rec.samples ?? [];
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
            const ytSearch = `https://music.youtube.com/search?q=${encodeURIComponent(
              `${s.artist} ${s.title}`,
            )}`;
            return (
              <li key={i} className="flex items-baseline gap-1.5">
                {/* The ▶ link opens YT Music search for the sample track in
                    a new tab. stopPropagation so the card-pick handler
                    doesn't fire — we don't want to commit a vote just
                    because the user wanted to preview a track. */}
                <a
                  href={ytSearch}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-rose-200 hover:bg-rose-500/30 hover:text-white"
                  title={`Preview "${s.title}" on YouTube`}
                >
                  ▶
                </a>
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
