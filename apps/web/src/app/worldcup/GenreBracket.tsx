"use client";

import { genreHue } from "@/lib/forceGraph";
import type { Locale } from "@/lib/i18n";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { Bracket, ShareChampionButton, type Rec } from "./Bracket";
import { GenreCard } from "./GenreCard";

/**
 * Thin wrapper around Bracket that injects the genre card renderer +
 * a coloured genre-themed champion screen. All the round/pick/pattern
 * logic stays inside Bracket — this is just visual delegation.
 */
export function GenreBracket({
  initial,
  locale,
}: {
  initial: Rec[];
  locale: Locale;
}) {
  return (
    <Bracket
      locale={locale}
      initial={initial}
      rated={0}
      likes={0}
      dislikes={0}
      category="genre"
      renderCard={(c, onPick) => <GenreCard key={c.id} rec={c} onPick={onPick} />}
      renderChampion={(champion, onRestart) => (
        <GenreChampionView
          champion={champion}
          // GenreBracket lives outside Bracket's championId state — the
          // OG share link isn't wired through here yet, so pass null and
          // the share button falls back to /worldcup. TODO: lift state
          // up to expose championId to renderChampion callers.
          championId={null}
          onRestart={onRestart}
          locale={locale}
        />
      )}
    />
  );
}

/** Genre champion view — same layout as the song champion view but
 *  showing genre name + colour swatch + sample tracks. */
function GenreChampionView({
  champion,
  championId,
  onRestart,
  locale,
}: {
  champion: Rec;
  championId: string | null;
  onRestart: () => void;
  locale: Locale;
}) {
  const t = worldcupDict(locale);
  const hue = genreHue(champion.id);
  return (
    <div
      className="flex flex-col items-center gap-5 rounded-2xl border border-amber-400/30 p-8 text-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 22%) 0%, hsl(${
          (hue + 50) % 360
        } 45% 8%) 100%)`,
      }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
        🏆 {t.genreChampionBadge}
      </p>
      <h2 className="text-4xl font-extrabold capitalize leading-tight">
        {champion.id}
      </h2>
      {champion.samples && champion.samples.length > 0 && (
        <ul className="max-w-sm text-sm text-white/70">
          {champion.samples.slice(0, 3).map((s, i) => (
            <li key={i} className="truncate">
              {s.title} · <span className="text-white/50">{s.artist}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <ShareChampionButton
          champion={champion}
          championId={championId}
          locale={locale}
        />
        <button
          onClick={onRestart}
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          {t.genreNewTournament}
        </button>
      </div>
    </div>
  );
}
