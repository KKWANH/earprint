"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { recommendDict } from "@/lib/i18n/recommend";
import { useAudioPlayer } from "@/lib/useAudioPlayer";

/** Generic candidate the worldcup can use across data sources (liked
 *  tracks, recommendations, mixed, genres). The bracket is informational —
 *  champion sits in component state, nothing writes back to a per-source
 *  table. The user starts a new tournament when they're done. */
export interface BracketCandidate {
  id: string;
  artist: string;
  title: string;
  coverUrl: string | null;
  /** Deezer track ID — drives the 30 s preview button. Optional. */
  deezerId: number | null;
  /** Source-emitted ranking (rec score, recency weight…). Powers the
   *  favorites/opposites patterns; null treated as 0. */
  score: number | null;
  /** Source tag for the cross-mode pattern. "liked" / "discover" /
   *  "song" / "unheard" / "genre" etc. */
  recType: string;
  /** Sample tracks — populated only by genre candidates (so the
   *  GenreCard can show "indie sleaze · including these tracks of
   *  yours: …"). Song candidates leave this undefined. */
  samples?: { artist: string; title: string }[];
  /** This genre's share of the analysed library (0..1). Genre-only.
   *  GenreCard renders it as a "12% of your library" badge so the user
   *  knows whether they're comparing core taste vs. edge cases. */
  libraryShare?: number;
}

// Backwards-compat name — older callers imported `Rec`. The shape
// matches BracketCandidate exactly.
export type Rec = BracketCandidate;

/**
 * 이상형월드컵-style knockout bracket. Picks the largest power of two ≤ N
 * (typically 8 from a 20-candidate batch), runs proper rounds, and uses
 * the elimination round as the rating signal:
 *
 *   round-1 losers  → pass     (didn't survive the first cut)
 *   later  losers   → like     (beat at least one other candidate)
 *   champion        → superlike
 *
 * State is a running `bracket` array (current round's contestants) plus
 * an accumulator of winners for the next round. When `bracket.length`
 * shrinks to 1 we have a champion and rate them, then the user can start
 * a new tournament from any leftover recs.
 *
 * Earlier this file ran sequential pairs (not a true bracket). The
 * tournament path is what user testing actually asked for — sequential
 * was a quick stand-in.
 */

type Layout = {
  size: 4 | 8 | 16 | 32 | 64 | 128 | 256;
  totalRounds: number;
};
type Pattern = "random" | "favorites" | "opposites" | "cross";

/** Picks the largest power-of-two bracket size ≤ the candidate count.
 *  Up to 256 (8 rounds, ~12 min of clicking) for the big-library users
 *  who explicitly asked for it. Below 4 candidates we return null and
 *  the runner shows "need more" instead of starting a useless bracket. */
function chooseLayout(n: number): Layout | null {
  if (n >= 256) return { size: 256, totalRounds: 8 };
  if (n >= 128) return { size: 128, totalRounds: 7 };
  if (n >= 64)  return { size: 64,  totalRounds: 6 };
  if (n >= 32)  return { size: 32,  totalRounds: 5 };
  if (n >= 16)  return { size: 16,  totalRounds: 4 };
  if (n >= 8)   return { size: 8,   totalRounds: 3 };
  if (n >= 4)   return { size: 4,   totalRounds: 2 };
  return null;
}

/** Reorders the initial slice according to the chosen match-up pattern.
 *  The bracket flow downstream is unchanged — `bracket[0,1]` is always
 *  the first pair, `[2,3]` the second, etc. — so different patterns
 *  produce completely different first-round matchups without any extra
 *  state. */
function arrangeBracket(picks: Rec[], pattern: Pattern, size: number): Rec[] {
  const top = picks.slice(0, size);
  switch (pattern) {
    case "random":
      return shuffleInPlace([...top]);

    case "favorites":
      // Score desc: the strongest recommendations meet immediately. By
      // the final round you've voted on your top 4 against each other.
      return [...top].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    case "opposites": {
      // Sorted by score, then paired ends-to-middle so every first-round
      // matchup is highest-score vs lowest-score. Tells you whether the
      // "obvious" pick beats a wildcard.
      const sorted = [...top].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const result: Rec[] = [];
      const half = sorted.length / 2;
      for (let i = 0; i < half; i++) {
        result.push(sorted[i]!);
        result.push(sorted[sorted.length - 1 - i]!);
      }
      return result;
    }

    case "cross": {
      // Group by recType and interleave. A song-based rec sits next to
      // an unheard-genre rec, so the matchup actually asks "current
      // taste vs. discovery?" rather than comparing two cousins.
      const byType = new Map<string, Rec[]>();
      for (const r of top) {
        const arr = byType.get(r.recType) ?? [];
        arr.push(r);
        byType.set(r.recType, arr);
      }
      const types = Array.from(byType.keys());
      const result: Rec[] = [];
      let safety = 0;
      while (result.length < top.length && safety++ < top.length * 2) {
        for (const t of types) {
          const next = byType.get(t)?.shift();
          if (next) result.push(next);
          if (result.length >= top.length) break;
        }
      }
      return result;
    }
  }
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function Bracket({
  initial,
  rated,
  likes,
  dislikes,
  locale,
  renderCard,
  renderChampion,
  category,
}: {
  initial: Rec[];
  rated: number;
  likes: number;
  dislikes: number;
  locale: Locale;
  /** Optional custom card renderer — used by the genre bracket runner
   *  which has a totally different card shape (genre name + samples,
   *  no cover/preview). Defaults to the song-style BracketCard. */
  renderCard?: (c: Rec, onPick: () => void) => React.ReactNode;
  /** Optional custom champion view, same reason. */
  renderChampion?: (champion: Rec, onRestart: () => void) => React.ReactNode;
  /** When set, the champion is POSTed to /api/worldcup/champion so the
   *  user has a history. The string identifies the tournament category
   *  (matches /lib/worldcup.ts WorldcupCategory). Pass `undefined` to
   *  skip persistence (legacy /recommend-style callers). */
  category?: string;
}) {
  const t = recommendDict(locale);
  const router = useRouter();

  const layout = chooseLayout(initial.length);
  // Cache key for localStorage progress save. Tied to category + size +
  // the first candidate's id so a different "initial" batch starts a
  // fresh tournament. The 128 / 256 brackets take long enough that an
  // accidental refresh would otherwise lose 5–10 minutes of clicking.
  const cacheKey = category && layout
    ? `pa-wc:${category}:${layout.size}:${initial[0]?.id ?? ""}`
    : null;

  // Hydrate from localStorage if a matching saved tournament exists.
  // We restore pattern + bracket + winners + pairIdx + round but NOT
  // champion — finishing the tournament after a refresh re-fires the
  // save-champion API which would create a duplicate history row.
  const restored = (() => {
    if (typeof window === "undefined" || !cacheKey) return null;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as {
        pattern: Pattern;
        round: number;
        bracket: Rec[];
        winners: Rec[];
        pairIdx: number;
      };
    } catch {
      return null;
    }
  })();

  const [pattern, setPattern] = useState<Pattern>(restored?.pattern ?? "random");
  const [round, setRound] = useState(restored?.round ?? 0);
  const [bracket, setBracket] = useState<Rec[]>(() =>
    restored?.bracket
      ?? (layout ? arrangeBracket(initial, "random", layout.size) : []),
  );
  const [winners, setWinners] = useState<Rec[]>(restored?.winners ?? []);
  const [pairIdx, setPairIdx] = useState(restored?.pairIdx ?? 0);
  const [champion, setChampion] = useState<Rec | null>(null);
  // Server-assigned ID of the persisted champion. Powers the OG share
  // link — the URL `/worldcup/champion/{championId}` has a dedicated
  // OG image rendered by next/og. Null while the save is in flight or
  // when `category` is undefined (informational-only mode).
  const [championId, setChampionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ rated, likes, dislikes });

  // Persist progress after every state-changing pick. Wrapped in try
  // so a private-mode "QuotaExceeded" doesn't break the bracket.
  useEffect(() => {
    if (!cacheKey || champion) return;
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({ pattern, round, bracket, winners, pairIdx }),
      );
    } catch {
      /* localStorage full / private mode — fine, just no save */
    }
  }, [cacheKey, champion, pattern, round, bracket, winners, pairIdx]);

  // Once we have a champion the saved state is no longer interesting —
  // clear it so the next tournament with the same cache key starts fresh.
  useEffect(() => {
    if (champion && cacheKey) {
      try {
        window.localStorage.removeItem(cacheKey);
      } catch {
        /* ignore */
      }
    }
  }, [champion, cacheKey]);

  /** Restart the bracket with a new pattern. Reset round/pair/winners
   *  so the user is back at round 0 with a fresh ordering. */
  function applyPattern(p: Pattern) {
    if (!layout) return;
    setPattern(p);
    setBracket(arrangeBracket(initial, p, layout.size));
    setWinners([]);
    setRound(0);
    setPairIdx(0);
    setChampion(null);
  }

  if (!layout) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-sm text-neutral-400">
          {t.bracketNeedMore(initial.length, 4)}
        </p>
        <button
          onClick={() => router.refresh()}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
        >
          {t.bracketRestart}
        </button>
      </div>
    );
  }

  // Pure state-machine pick — no DB writes. The bracket is informational:
  // the champion is shown locally and nothing persists. If we later want
  // to record ratings per-tournament, lift an `onPick` callback into the
  // props and let the caller decide.
  function pick(winner: Rec, loser: Rec) {
    if (busy) return;
    setBusy(true);
    // Track counts purely for the strip-display under the cards.
    const loserSoft: "like" | "pass" = round === 0 ? "pass" : "like";
    void loser; // referenced only so the lint doesn't complain
    const newWinners = [...winners, winner];
    const nextPairIdx = pairIdx + 1;
    const pairsInRound = bracket.length / 2;

    setCounts((c) => ({
      rated: c.rated + 1,
      likes: c.likes + (loserSoft === "like" ? 1 : 0),
      dislikes: c.dislikes + (loserSoft === "pass" ? 1 : 0),
    }));

    if (nextPairIdx < pairsInRound) {
      setWinners(newWinners);
      setPairIdx(nextPairIdx);
      setBusy(false);
      return;
    }

    // Round complete.
    if (newWinners.length === 1) {
      setCounts((c) => ({
        rated: c.rated + 1,
        likes: c.likes + 1,
        dislikes: c.dislikes,
      }));
      const champ = newWinners[0]!;
      setChampion(champ);
      // Persist to tournament_results. We don't block the champion
      // screen waiting for the network — the celebration shows
      // immediately and the Share button updates the moment the
      // returned id lands. A failed save just means no OG share URL
      // for this run (it falls back to the plain text share).
      if (category && layout) {
        void (async () => {
          try {
            const res = await fetch("/api/worldcup/champion", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                category,
                size: layout.size,
                pattern,
                champion: champ,
              }),
            });
            if (res.ok) {
              const d = (await res.json()) as { id?: string };
              if (d.id) setChampionId(d.id);
            }
          } catch {
            /* save failure → no OG share link, plain text only */
          }
        })();
      }
      setBusy(false);
      return;
    }

    // Advance to the next round with the winners as the new bracket.
    setBracket(newWinners);
    setWinners([]);
    setPairIdx(0);
    setRound(round + 1);
    setBusy(false);
  }

  function restart() {
    // Top up from the leftover candidates (anything past the original
    // bracket size). When the user has used everything, just refresh the
    // page — the parent will re-fetch.
    const consumed = layout!.size;
    const remaining = initial.slice(consumed);
    const nextLayout = chooseLayout(remaining.length);
    if (!nextLayout) {
      router.refresh();
      return;
    }
    setBracket(arrangeBracket(remaining, pattern, nextLayout.size));
    setWinners([]);
    setRound(0);
    setPairIdx(0);
    setChampion(null);
  }

  if (champion) {
    return renderChampion
      ? <>{renderChampion(champion, restart)}</>
      : <ChampionView
          champion={champion}
          championId={championId}
          onRestart={restart}
          locale={locale}
        />;
  }

  const left = bracket[pairIdx * 2]!;
  const right = bracket[pairIdx * 2 + 1]!;
  const pairsInRound = bracket.length / 2;

  return (
    <div className="flex flex-col gap-4">
      <PatternPicker
        active={pattern}
        onChange={applyPattern}
        disabled={busy}
        locale={locale}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-emerald-300">
          {t.bracketRound(round, layout.totalRounds)}
        </span>
        <span className="text-neutral-500">
          {t.bracketPairOf(pairIdx + 1, pairsInRound)}
        </span>
      </div>
      <p className="text-center text-xs text-neutral-400">{t.bracketHint}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {renderCard
          ? renderCard(left, () => pick(left, right))
          : <BracketCard rec={left} onPick={() => pick(left, right)} locale={locale} />}
        {renderCard
          ? renderCard(right, () => pick(right, left))
          : <BracketCard rec={right} onPick={() => pick(right, left)} locale={locale} />}
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {counts.rated} {t.countsRated} · {counts.likes} ♥ / {counts.dislikes} ✗
        </span>
        <BracketProgress round={round} totalRounds={layout.totalRounds} />
      </div>
    </div>
  );
}

/** Match-up pattern selector — changes how the 8 candidates are paired
 *  in round 1. Picking a new pattern restarts the bracket immediately
 *  (otherwise the user would be mid-round with stale matchups). */
function PatternPicker({
  active,
  onChange,
  disabled,
  locale,
}: {
  active: Pattern;
  onChange: (p: Pattern) => void;
  disabled: boolean;
  locale: Locale;
}) {
  const t = recommendDict(locale);
  const items: { id: Pattern; label: string }[] = [
    { id: "random", label: t.bracketPatternRandom },
    { id: "favorites", label: t.bracketPatternFavorites },
    { id: "opposites", label: t.bracketPatternOpposites },
    { id: "cross", label: t.bracketPatternCross },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-neutral-500">
        {t.bracketPatternTitle}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            disabled={disabled || active === it.id}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active === it.id
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-white"
            } disabled:opacity-60`}
          >
            {it.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-neutral-500">
        {t.bracketPatternHint}
      </p>
    </div>
  );
}

/** Tiny dot-row that shows the user where in the bracket they are. */
function BracketProgress({
  round,
  totalRounds,
}: {
  round: number;
  totalRounds: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalRounds }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${
            i < round
              ? "bg-emerald-500"
              : i === round
                ? "bg-emerald-300"
                : "bg-white/15"
          }`}
        />
      ))}
    </div>
  );
}

/** Celebration screen for the bracket champion. Shown until the user
 *  chooses to start another tournament or refresh for new recs. */
function ChampionView({
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
  const t = recommendDict(locale);
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-900 p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
        {t.bracketChampionTitle}
      </p>
      <div className="relative aspect-square w-48 overflow-hidden rounded-2xl border border-amber-400/40 bg-neutral-800">
        {champion.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={champion.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-neutral-600">
            ♪
          </div>
        )}
      </div>
      <div className="max-w-sm">
        <p className="text-lg font-bold leading-tight">{champion.title}</p>
        <p className="text-sm text-neutral-400">{champion.artist}</p>
      </div>
      <p className="max-w-md text-xs text-neutral-500">{t.bracketChampionSub}</p>
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
          {t.bracketRestart}
        </button>
      </div>
    </div>
  );
}

/** "Share my champion" — uses the Web Share API on mobile / Safari and
 *  falls back to clipboard.writeText elsewhere. Builds a short text
 *  with a backlink to Earprint so re-shares are attributable. Works
 *  for both song and genre champions — the calling renderChampion
 *  passes its own version for genre formatting. */
export function ShareChampionButton({
  champion,
  championId,
  locale,
}: {
  champion: Rec;
  /** When non-null, the share URL points at /worldcup/champion/{id} —
   *  which has a dedicated OG image. Falls back to /worldcup when null
   *  (save still in flight or category undefined). */
  championId: string | null;
  locale: Locale;
}) {
  const [note, setNote] = useState<string | null>(null);
  async function share() {
    // For genre champions `title` is the genre name and `artist` is "";
    // build a single line that reads naturally for both.
    const subject = champion.artist
      ? `${champion.title} — ${champion.artist}`
      : champion.title;
    const url = championId
      ? `https://earprint.kwanho.dev/worldcup/champion/${championId}`
      : "https://earprint.kwanho.dev/worldcup";
    const text =
      locale === "ko"
        ? `🏆 내 월드컵 우승: ${subject}\n${url}`
        : `🏆 My World Cup champion: ${subject}\n${url}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text, url });
        setNote(locale === "ko" ? "공유 완료" : "Shared");
        return;
      }
      await navigator.clipboard.writeText(text);
      setNote(locale === "ko" ? "복사됨" : "Copied");
    } catch {
      setNote(locale === "ko" ? "공유 실패" : "Share failed");
    }
  }
  return (
    <button
      onClick={share}
      className="rounded-md border border-amber-400/40 bg-amber-500/15 px-5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
    >
      🔗 {note ?? (locale === "ko" ? "공유" : "Share")}
    </button>
  );
}

/**
 * One card in the head-to-head pair. Click anywhere on the card body to
 * pick it; the YouTube link opens out in a new tab without picking, since
 * we'd lose the bracket state otherwise.
 */
function BracketCard({
  rec,
  onPick,
  locale,
}: {
  rec: Rec;
  onPick: () => void;
  locale: Locale;
}) {
  const t = recommendDict(locale);
  const { playing, toggle } = useAudioPlayer(rec.deezerId);
  const [hover, setHover] = useState(false);
  // YouTube videoId — fetched lazily on mount via /api/recommend/yt-search.
  // Null until the request resolves; null forever if Google's quota is
  // exhausted or the env key isn't set. The card still works without it
  // (Deezer preview + search link).
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/recommend/yt-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: rec.artist, title: rec.title }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { videoId?: string | null } | null) => {
        if (!cancelled && d?.videoId) setVideoId(d.videoId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rec.artist, rec.title]);

  // Prefer a direct video link when we have one — saves the user a click
  // through search results. Falls back to YT Music search otherwise.
  const ytLink = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : `https://music.youtube.com/search?q=${encodeURIComponent(
        `${rec.artist} ${rec.title}`,
      )}`;

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
      className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border bg-neutral-900 p-4 transition-all ${
        hover
          ? "border-emerald-500/60 bg-emerald-500/5"
          : "border-white/10"
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-800">
        {showVideo && videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1`}
            title={`${rec.artist} — ${rec.title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full"
          />
        ) : rec.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rec.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-neutral-600">
            ♪
          </div>
        )}
        {/* When the iframe is mounted it owns the player surface; both
            inline buttons hide so we don't end up with two audio sources
            fighting each other. */}
        {!showVideo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // If we have a Data-API-resolved videoId, embed the iframe
              // inline. If not (env key missing / quota exhausted / lookup
              // still in flight), open YT search in a new tab — that's
              // still useful, and beats the previous behaviour of the
              // button just being absent. The fallback URL works without
              // YOUTUBE_API_KEY because it's the public search page.
              if (videoId) {
                setShowVideo(true);
              } else {
                window.open(ytLink, "_blank", "noopener");
              }
            }}
            className="absolute bottom-2 left-2 flex h-9 items-center gap-1 rounded-full bg-rose-600/90 px-3 text-xs font-medium text-white backdrop-blur hover:bg-rose-500"
            aria-label="Play YouTube"
            title={videoId ? "Play inline" : "Open YouTube search"}
          >
            ▶ YT{videoId ? "" : " ↗"}
          </button>
        )}
        {!showVideo && rec.deezerId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggle();
            }}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-black/90"
            aria-label={playing ? "Pause" : "Play"}
            title="Deezer 30s preview"
          >
            {playing ? "⏸" : "▶"}
          </button>
        )}
      </div>
      <div className="min-h-[3.5em]">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {rec.title}
        </p>
        <p className="line-clamp-1 text-xs text-neutral-400">{rec.artist}</p>
      </div>
      <a
        href={ytLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-center text-[11px] text-rose-300 underline-offset-2 hover:text-rose-200 hover:underline"
      >
        {t.bracketWatchYt}
      </a>
    </div>
  );
}
