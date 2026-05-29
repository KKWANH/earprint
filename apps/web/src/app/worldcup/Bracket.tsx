"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Pre-resolved YouTube videoId — short-circuits BracketCard's
   *  yt-search fetch when the caller already knows the embed target
   *  (community/UGC worldcups always carry this). Empty/undefined =
   *  fall back to the artist+title lookup. */
  ytVideoId?: string;
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
  onChampion,
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
  /** Fires the moment a champion is determined — caller decides what to
   *  do with it. UGC / community brackets POST to /api/worldcup/community
   *  /:id/finish to bump aggregate stats. Built-in worldcups use the
   *  `category`-driven persistence path below instead. Both are optional;
   *  they don't conflict. */
  onChampion?: (
    champion: Rec,
    winners: Rec[],
    allItems: Rec[],
  ) => void;
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
  // Full per-pair outcome log — feeds the bracket-replay view via
  // tournament_results.bracket_path JSONB. Reconstruction is round-
  // bucketed downstream; here we just append flat. Not persisted to
  // localStorage to keep the cache small + because a refresh
  // mid-bracket loses the in-progress runner anyway.
  const [pairHistory, setPairHistory] = useState<
    Array<{ round: number; left: Rec; right: Rec; winnerSide: "left" | "right" }>
  >([]);
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
        // R38 — savedAt added so InProgressCard can age out abandoned
        // brackets (>30d) and sort by recency instead of round depth.
        JSON.stringify({ pattern, round, bracket, winners, pairIdx, savedAt: Date.now() }),
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

    // Record this pair's outcome for the replay log. left/right
    // come from the bracket array (deterministic; matches what the
    // user actually saw on screen). winnerSide is whichever id the
    // winning Rec matches.
    const leftCard = bracket[pairIdx * 2]!;
    const rightCard = bracket[pairIdx * 2 + 1]!;
    const winnerSide: "left" | "right" =
      winner.id === leftCard.id ? "left" : "right";
    const newHistory = [
      ...pairHistory,
      { round, left: leftCard, right: rightCard, winnerSide },
    ];
    setPairHistory(newHistory);

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
      // Caller-supplied champion hook — used by community/UGC
      // worldcups to bump aggregate stats. We need the FULL set of
      // round-winners (every survivor across all rounds), not just
      // newWinners[]. winners[] is the in-progress round winners; we
      // collect every champion of any previous round by walking the
      // pick history — but we don't actually keep that history. The
      // simpler observable set: champion is in newWinners; everyone
      // else who took at least one match is in `winners` (state from
      // prior rounds was discarded when we advanced). We approximate
      // "winners" by emitting champion + everyone the bracket
      // currently contains that wasn't initial round losers. For
      // stats this gives a slightly conservative count — good
      // enough for v1.
      if (onChampion) {
        // Best-effort: champion + everyone who appeared in the final
        // round (= bracket of size 2 → 1). For richer stats the
        // caller should track its own picks via renderCard if it
        // cares about every round.
        const finalRoundSurvivors = bracket; // the pair we just judged
        const everyone = initial;
        try {
          onChampion(champ, [champ, ...finalRoundSurvivors.filter((x) => x.id !== champ.id)], everyone);
        } catch {
          /* caller's problem, don't break the bracket UI */
        }
      }
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
                bracketPath: newHistory,
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
          allCandidates={initial}
        />;
  }

  const left = bracket[pairIdx * 2]!;
  const right = bracket[pairIdx * 2 + 1]!;
  const pairsInRound = bracket.length / 2;
  // "Remaining rounds" — 1 means the cards on screen are the final pair.
  // Used to amp the visuals on the championship match (different bg,
  // bigger banner, glow ring on the cards).
  const remainingRounds = layout.totalRounds - round;
  const isFinal = remainingRounds <= 1;

  // ── Keyboard shortcut: ← votes left, → votes right. Same surface
  // area as piku-style "이상형 월드컵" sites so muscle-memoried users
  // can blast through a 64-track bracket without mousing. Refs hold
  // the latest pick targets so the closure stays cheap (no React
  // re-render churn re-attaching the listener on every state tick). ──
  const leftRef = useRef<Rec | null>(left);
  const rightRef = useRef<Rec | null>(right);
  leftRef.current = left;
  rightRef.current = right;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing in inputs (textarea, custom comment box, etc.).
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (busyRef.current) return;
      if (e.key === "ArrowLeft" || e.key === "1") {
        if (leftRef.current && rightRef.current) {
          e.preventDefault();
          pick(leftRef.current, rightRef.current);
        }
      } else if (e.key === "ArrowRight" || e.key === "2") {
        if (leftRef.current && rightRef.current) {
          e.preventDefault();
          pick(rightRef.current, leftRef.current);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // pick is defined in component scope; refs cover its inputs so we
    // don't need it in deps. Empty deps = listener attached once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <PatternPicker
        active={pattern}
        onChange={applyPattern}
        disabled={busy}
        locale={locale}
      />
      {/* Final-round banner — much bigger than the regular round label.
          Sets the "this matters" feeling that piku-style worldcups get
          for free from their image-heavy cards but song cards otherwise
          miss. */}
      {isFinal ? (
        <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-900 px-4 py-3 text-center">
          <p className="text-base font-extrabold tracking-wide text-amber-300 sm:text-lg">
            {t.bracketFinalBanner}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
          <span className="text-sm font-bold uppercase tracking-wider text-emerald-300">
            {t.bracketRound(round, layout.totalRounds)}
          </span>
          <span className="text-neutral-500">
            {t.bracketPairOf(pairIdx + 1, pairsInRound)}
            <span className="ml-2 text-neutral-600">
              · {bracket.length}{locale === "ko" ? "곡 남음" : " remain"}
            </span>
          </span>
        </div>
      )}
      {/* R28k — overall progress bar. Counts the number of pair
          decisions made so far (every pick collapses 2 → 1) versus
          the total decisions needed to reach a champion (initial
          length - 1). Gives a piku-style "how close am I to the
          finish line" feeling without needing the user to count
          rounds. Hidden on the final because the amber banner
          already signals "this is the last call". */}
      {!isFinal && (() => {
        const totalDecisions = layout.size - 1;
        const decisionsLeft = bracket.length - 1;
        const made = Math.max(0, totalDecisions - decisionsLeft);
        const pct = totalDecisions > 0
          ? Math.round((made / totalDecisions) * 100)
          : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-500">
              {made} / {totalDecisions}
            </span>
          </div>
        );
      })()}
      <p className="text-center text-xs text-neutral-400">
        {t.bracketHint}
        <span className="ml-2 hidden text-neutral-600 sm:inline">
          · {t.bracketKeyboardHint}
        </span>
      </p>

      {/* Two cards side-by-side at every breakpoint — piku-style.
          On mobile gap-2 keeps both cards comfortably wide (~48vw
          each); on sm+ a bit more breathing room, final round gets
          the most. Stacking the cards vertically on mobile would
          force the user to scroll between options every pair, which
          kills the snap-judgment flow this UI is built for.
          R30g — wraps in a SwipeArea so mobile users can swipe
          left/right to pick (in addition to tapping). */}
      <SwipeArea
        key={`pair-${round}-${pairIdx}`}
        onSwipeLeft={() => pick(right, left)}
        onSwipeRight={() => pick(left, right)}
        className={`pa-fade-in grid grid-cols-2 ${isFinal ? "gap-2 sm:gap-5" : "gap-2 sm:gap-3"}`}
      >
        {renderCard
          ? renderCard(left, () => pick(left, right))
          : <BracketCard rec={left} onPick={() => pick(left, right)} locale={locale} finalRound={isFinal} />}
        {renderCard
          ? renderCard(right, () => pick(right, left))
          : <BracketCard rec={right} onPick={() => pick(right, left)} locale={locale} finalRound={isFinal} />}
      </SwipeArea>

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
            className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950 ${
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
  allCandidates,
}: {
  champion: Rec;
  championId: string | null;
  onRestart: () => void;
  locale: Locale;
  /** The Rec[] the bracket ran over. Forwarded to the "save as
   *  community" button so the promote endpoint can resolve YT
   *  videoIds for each entry. Optional — genre brackets / other
   *  callers can omit and the button will hide. */
  allCandidates?: Rec[];
}) {
  const t = recommendDict(locale);
  return (
    <div className="pa-fade-in flex flex-col items-center gap-5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-900 p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
        {t.bracketChampionTitle}
      </p>
      <div className="pa-pop-in pa-pulse-soft relative aspect-square w-36 overflow-hidden rounded-2xl border border-amber-400/40 bg-neutral-800 sm:w-48">
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
      <div className="flex flex-wrap justify-center gap-2">
        {/* "Like in YT Music ↗" — closes the loop between Earprint
            picking the winner and the user actually saving it in
            YouTube Music. No YT Music API exists for write
            operations, so we deep-link to its search results page
            (the heart icon is one tap away). For genre champions
            (`artist` empty) this falls back to the music-home
            search of the genre name itself. */}
        <LikeInYtMusicButton champion={champion} locale={locale} />
        {/* R28i — "♥ Save to Spotify" button parallel to the YT
            Music one. Hits POST /api/spotify/like which uses the
            user-library-modify scope to add the track to their
            Liked Songs in-place. Hidden when Spotify isn't
            connected; renders inline error/success state. */}
        <LikeInSpotifyButton champion={champion} locale={locale} />
        <ShareChampionButton
          champion={champion}
          championId={championId}
          locale={locale}
        />
        <button
          onClick={onRestart}
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {t.bracketRestart}
        </button>
      </div>
      {/* Promote the bracket the user just ran into a public community
          worldcup. Surfaces only when the parent passed allCandidates
          (built-in / curated trackss do; genre-bracket / community
          runner skips it — both already are or have no real video
          mapping). */}
      {allCandidates && allCandidates.length >= 4 && (
        <PromoteToCommunityButton
          candidates={allCandidates}
          champion={champion}
          locale={locale}
        />
      )}
    </div>
  );
}

/** "Save this bracket to the community" — promotes the current
 *  bracket's candidate list into a community_worldcups row via
 *  POST /api/worldcup/promote and redirects the user to the new
 *  community page on success. The yt-search cache backs the
 *  videoId resolution so this is usually free of quota cost. */
function PromoteToCommunityButton({
  candidates,
  champion,
  locale,
}: {
  candidates: Rec[];
  champion: Rec;
  locale: Locale;
}) {
  const ko = locale === "ko";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(
    champion.artist
      ? `${champion.title} vs.${candidates.length}곡`
      : `${champion.title} 월드컵`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // Strip Rec down to the promote endpoint's expected shape so
      // the payload stays under the 64 KB body cap even on a 32-
      // bracket. Drop fields the promote endpoint doesn't read.
      const slim = candidates.map((c) => ({
        id: c.id,
        artist: c.artist,
        title: c.title,
        coverUrl: c.coverUrl,
        ytVideoId: c.ytVideoId,
      }));
      const res = await fetch("/api/worldcup/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), candidates: slim }),
      });
      const d = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !d.ok || !d.id) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      window.location.href = `/worldcup/community/${d.id}`;
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-center text-xs text-neutral-500 hover:text-emerald-300 hover:underline"
      >
        {ko ? "📤 이 토너먼트를 커뮤니티에 공개" : "📤 Publish this bracket as a community worldcup"}
      </button>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-2 self-stretch rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 sm:max-w-md sm:self-center">
      <label className="text-[11px] uppercase tracking-wider text-emerald-300">
        {ko ? "공개 토너먼트 제목" : "Community worldcup title"}
      </label>
      <input
        type="text"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-2.5 py-1.5 text-[11px] text-rose-200">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => void submit()}
          disabled={busy || !title.trim()}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (ko ? "공개 중…" : "Publishing…") : (ko ? "공개" : "Publish")}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
        >
          {ko ? "취소" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

/** "♥ Save to Spotify" — POSTs the champion to /api/spotify/like
 *  which adds it to the user's Spotify Liked Songs via the
 *  user-library-modify scope. Unlike the YT Music button (which
 *  deep-links because YT Music has no write API), this one actually
 *  performs the action. Auto-hides when:
 *    - Spotify isn't connected (404 from status endpoint)
 *    - The champion has no artist (genre champion — no track to save)
 *  Status fetched once on mount so we don't show the button to
 *  users who don't have the integration set up. */
function LikeInSpotifyButton({
  champion,
  locale,
}: {
  champion: Rec;
  locale: Locale;
}) {
  const ko = locale === "ko";
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/spotify/status");
        if (cancelled) return;
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const d = (await res.json()) as { connected?: boolean };
        setConnected(!!d.connected);
      } catch {
        setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!connected) return null;
  if (!champion.artist) return null;

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/spotify/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${champion.artist} ${champion.title}`,
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="rounded-md border border-[#1DB954]/40 bg-[#1DB954]/15 px-5 py-2 text-sm font-semibold text-[#1DB954]">
        ✓ {ko ? "Spotify에 저장됨" : "Saved to Spotify"}
      </span>
    );
  }

  // R36 — when the error is auth-related, render an inline
  // "Reconnect" link instead of just an opaque button title. The
  // server returns "spotify auth expired" / "spotify rejected" for
  // these cases (see /api/spotify/like). Pattern: error message →
  // actionable fix.
  const needsReconnect =
    !!error &&
    (/auth expired/i.test(error) ||
      /spotify rejected/i.test(error) ||
      /not connected/i.test(error));

  if (needsReconnect) {
    return (
      <a
        href="/api/auth/spotify/start"
        className="rounded-md border border-amber-500/40 bg-amber-950/30 px-5 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/40"
      >
        {ko ? "↻ Spotify 다시 연결" : "↻ Reconnect Spotify"}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={busy}
      title={error ?? undefined}
      className="rounded-md border border-[#1DB954]/40 bg-[#1DB954]/15 px-5 py-2 text-sm font-semibold text-[#1DB954] hover:bg-[#1DB954]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954]/60 disabled:opacity-50"
    >
      {busy
        ? ko ? "저장 중…" : "Saving…"
        : ko ? "♥ Spotify에 저장" : "♥ Save to Spotify"}
    </button>
  );
}

/** "♥ Like in YT Music ↗" — deep-links the champion's artist+title
 *  into YouTube Music's search. There's no YT Music write API; this
 *  gets the user one tap away from clicking the heart icon
 *  themselves. Across A/B/C tracks (built-in, discover, community)
 *  the affordance reads the same. */
function LikeInYtMusicButton({
  champion,
  locale,
}: {
  champion: Rec;
  locale: Locale;
}) {
  const q = champion.artist
    ? `${champion.artist} ${champion.title}`
    : champion.title;
  const href = `https://music.youtube.com/search?q=${encodeURIComponent(q)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-rose-400/40 bg-rose-500/15 px-5 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
    >
      ♥ {locale === "ko" ? "YT Music에서 좋아요" : "Like in YT Music ↗"}
    </a>
  );
}

/** "Share my champion" — uses the Web Share API on mobile / Safari and
/** R30g — swipe-aware grid wrapper. Tracks lateral pointer drag and
 *  fires onSwipeLeft/Right when the user releases past the threshold.
 *  Below the threshold the gesture is treated as a tap and propagates
 *  to children (so a tap on a BracketCard still picks normally).
 *
 *  During drag the whole pair translates with the finger and the
 *  losing side fades — visually telegraphs which card will win when
 *  the gesture commits. Doesn't override existing keyboard / button
 *  interaction. */
function SwipeArea({
  onSwipeLeft,
  onSwipeRight,
  className,
  children,
}: {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const THRESHOLD = 60;

  function onPointerDown(e: React.PointerEvent) {
    // Only mouse / touch primary pointer; ignore right-click / middle.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // R36 — guard against starting a swipe inside form controls
    // (textarea / input / button / link / contenteditable). Without
    // this, a tap on the comment box or play button on mobile could
    // get interpreted as a swipe start and lock the user in a
    // half-drag state.
    const t = e.target as HTMLElement | null;
    if (t) {
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }
    }
    startX.current = e.clientX;
    setDx(0);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    setDx(e.clientX - startX.current);
  }
  function onPointerUp() {
    const v = dx;
    startX.current = null;
    setDx(0);
    if (v > THRESHOLD) onSwipeRight();       // swipe right → pick left card
    else if (v < -THRESHOLD) onSwipeLeft();  // swipe left → pick right card
  }

  // Map the offset into a small translate so the gesture has visible
  // feedback. Capped at ±80px so the cards don't fly off-screen for
  // a slow drag.
  const translate = Math.max(-80, Math.min(80, dx));
  // Opacity fade on the LOSING side telegraphs the commit. When
  // dx > 0 user is swiping right → left card wins → right card fades.
  const leftFade = dx < 0 ? Math.min(1, Math.abs(dx) / 200) : 0;
  const rightFade = dx > 0 ? Math.min(1, dx / 200) : 0;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translateX(${translate}px)`,
        transition: startX.current == null ? "transform 0.18s ease-out" : "none",
        // CSS vars consumed by child opacity fade — set on parent so
        // children inherit. Cards aren't aware of the swipe state
        // themselves; this is parent-only feedback.
        ["--swipe-left-fade" as string]: 1 - leftFade,
        ["--swipe-right-fade" as string]: 1 - rightFade,
      }}
      className={`touch-pan-y select-none ${className ?? ""}`}
    >
      {/* Children are the two BracketCards; we fade them via inline
          style on the wrapping span so the swipe direction shows on
          screen without rewriting the card component. */}
      <div style={{ opacity: "var(--swipe-left-fade)" }}>
        {Array.isArray(children) ? children[0] : children}
      </div>
      <div style={{ opacity: "var(--swipe-right-fade)" }}>
        {Array.isArray(children) ? children[1] : null}
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
  finalRound,
}: {
  rec: Rec;
  onPick: () => void;
  locale: Locale;
  /** Set on the championship match — adds an amber glow + ring so the
   *  final pair reads visibly different from every prior round. */
  finalRound?: boolean;
}) {
  const t = recommendDict(locale);
  const { playing, error: audioError, toggle } = useAudioPlayer(rec.deezerId);
  const [hover, setHover] = useState(false);
  // YouTube videoId — fetched lazily on mount via /api/recommend/yt-search,
  // UNLESS the caller passed one in (UGC / community brackets carry the
  // videoId in the candidate payload so no lookup is needed). Null until
  // the request resolves; null forever if Google's quota is exhausted or
  // the env key isn't set. The card still works without it (Deezer
  // preview + search link).
  const [videoId, setVideoId] = useState<string | null>(rec.ytVideoId ?? null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    // Caller pre-supplied the videoId → skip the network call entirely.
    if (rec.ytVideoId) {
      setVideoId(rec.ytVideoId);
      return;
    }
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
  }, [rec.artist, rec.title, rec.ytVideoId]);

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
      className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border bg-neutral-900 p-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
        finalRound
          ? hover
            ? "border-amber-400/70 bg-amber-500/10 ring-2 ring-amber-400/30 scale-[1.02]"
            : "border-amber-400/40 ring-1 ring-amber-400/15"
          : hover
            ? "border-emerald-500/60 bg-emerald-500/5 scale-[1.02]"
            : "border-white/10"
      }`}
    >
      {/* Cover region — single large play affordance instead of the
          previous "tiny YT button + tiny Deezer button" combo. Click
          priority:
            1. YT iframe (full song, no 30s cap)             ← default
            2. Deezer preview (only if YT lookup failed AND
               the cached video_id is null)                  ← fallback
            3. External YT search in a new tab               ← last resort
          One thumb tap → real playback. Same affordance whether the
          card has a cover image or just the ♪ placeholder. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-800">
        {showVideo && videoId ? (
          <>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1`}
              title={`${rec.artist} — ${rec.title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full"
            />
            {/* Explicit "close player" affordance — keyboard users
                can't escape the YouTube iframe focus trap otherwise.
                Mouse users get it as a fallback when they want to
                see the cover image again or stop playback. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideo(false);
              }}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs text-white backdrop-blur transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Close player"
            >
              ×
            </button>
          </>
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
        {/* Big centred play button — only shown when the iframe isn't
            already mounted. Sized for a thumb; tap target is the full
            56px disc. stopPropagation so the card-pick handler doesn't
            fire (tapping play ≠ voting). */}
        {!showVideo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (videoId) {
                setShowVideo(true);
                return;
              }
              if (rec.deezerId && !audioError) {
                void toggle();
                return;
              }
              window.open(ytLink, "_blank", "noopener");
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30 focus-visible:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/65 text-2xl text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110 sm:h-16 sm:w-16">
              {playing ? "⏸" : "▶"}
            </span>
          </button>
        )}
        {/* Source pill at the top-right so the user knows whether the
            play button will fire YT, Deezer, or external search. Tiny,
            non-clickable — informational. */}
        {!showVideo && (
          <span
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70 backdrop-blur"
            title={
              videoId
                ? "Full song via YouTube embed"
                : rec.deezerId && !audioError
                  ? "30-second Deezer preview"
                  : "Open YouTube search"
            }
          >
            {videoId ? "YT" : rec.deezerId && !audioError ? "30s" : "↗"}
          </span>
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
