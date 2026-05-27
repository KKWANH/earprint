"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { recommendDict } from "@/lib/i18n/recommend";
import { useAudioPlayer } from "@/lib/useAudioPlayer";

export interface Rec {
  id: string;
  artist: string;
  title: string;
  album: string | null;
  coverUrl: string | null;
  deezerId: number | null;
  seedTrack: string | null;
  score: number | null;
  recType: "song" | "genre" | "unheard" | "indie";
  /** 1–2 sentence "why this song matters" blurb. Null when not yet
   *  generated — the Tournament card kicks off a lazy POST to
   *  /api/recommend/describe on mount and renders the result inline. */
  description: string | null;
}

/** "Why recommended" header styling per recommendation mode. */
const HEADER: Record<Rec["recType"], { icon: string; bg: string; fg: string }> = {
  song: { icon: "❤️", bg: "bg-emerald-500/12", fg: "text-emerald-300" },
  genre: { icon: "🎼", bg: "bg-indigo-500/15", fg: "text-indigo-300" },
  unheard: { icon: "🧭", bg: "bg-amber-500/15", fg: "text-amber-300" },
  indie: { icon: "💎", bg: "bg-violet-500/15", fg: "text-violet-300" },
};

type Rating = "superlike" | "like" | "pass" | "dislike" | "strong_dislike" | "known";

const THRESHOLD = 100; // px drag distance to commit a swipe

/**
 * Tinder-style recommendation rating — swipe right/left/up to like/dislike/super-like,
 * buttons for finer ratings, undo, always-visible comment. Mobile-first layout.
 */
export function Tournament({
  initial,
  rated,
  likes,
  dislikes,
  locale,
}: {
  initial: Rec[];
  rated: number;
  likes: number;
  dislikes: number;
  locale: Locale;
}) {
  const t = recommendDict(locale);
  const HEADER_LABEL: Record<Rec["recType"], string> = {
    song: t.headerSong,
    genre: t.headerGenre,
    unheard: t.headerUnheard,
    indie: t.headerIndie,
  };
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flyOff, setFlyOff] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [counts, setCounts] = useState({ rated, likes, dislikes });
  // Tracks the rating that was assigned to each previous card so undo can
  // both reverse the server state AND restore the correct local counter
  // (likes -1 vs dislikes -1 vs just rated -1 for pass/known).
  const [history, setHistory] = useState<{ id: string; rating: Rating }[]>([]);
  // Surfaced when /api/recommend/rate or the undo POST fails — the
  // optimistic state change is rolled back and this banner explains why
  // the user is still on the same card. Dismissable; auto-clears on the
  // next successful action.
  const [err, setErr] = useState<string | null>(null);

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const prefetch = useRef<Promise<unknown> | null>(null);

  const current = initial[idx];
  const { playing, loading: loadingAudio, toggle: togglePlay, stop: stopAudio } =
    useAudioPlayer(current?.deezerId ?? null);

  // Generate the next batch a few cards early — by the time the user reaches
  // the end it is ready, so there is no ~10s wait.
  useEffect(() => {
    if (idx >= initial.length - 5 && !prefetch.current) {
      prefetch.current = fetch("/api/recommend/generate", { method: "POST" }).catch(
        () => {},
      );
    }
  }, [idx, initial.length]);

  async function commit(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
    setErr(null);
    stopAudio();
    const dir =
      rating === "like"
        ? { x: 620, y: 0 }
        : rating === "superlike"
          ? { x: 0, y: -720 }
          : rating === "dislike" || rating === "strong_dislike"
            ? { x: -620, y: 0 }
            : { x: 0, y: 620 };
    setFlyOff(dir);

    // Server first, optimistic UI second. If the rating doesn't persist
    // (network error, 401 expired session, 5xx), the card flies off but
    // never advances — we cancel the flyOff and surface an error so the
    // user knows the local counter wouldn't agree with what the server
    // sees on next refresh.
    let ok = false;
    try {
      const res = await fetch("/api/recommend/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, rating, comment }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setErr(t.ratingFailed);
      setFlyOff(null);
      setBusy(false);
      return;
    }

    setHistory((h) => [...h, { id: current.id, rating }]);
    setCounts((c) => ({
      rated: c.rated + 1,
      likes: c.likes + (rating === "like" || rating === "superlike" ? 1 : 0),
      dislikes:
        c.dislikes + (rating === "dislike" || rating === "strong_dislike" ? 1 : 0),
    }));
    await new Promise((r) => setTimeout(r, 300));
    setComment("");
    setDrag(null);
    setFlyOff(null);
    if (idx + 1 >= initial.length) {
      // The prefetch (started ~5 cards back) is usually already done.
      if (prefetch.current) await prefetch.current;
      else await fetch("/api/recommend/generate", { method: "POST" }).catch(() => {});
      router.refresh();
    } else {
      setIdx(idx + 1);
    }
    setBusy(false);
  }

  async function undo() {
    if (history.length === 0 || busy || idx === 0) return;
    setBusy(true);
    setErr(null);
    stopAudio();
    const last = history[history.length - 1]!;

    let ok = false;
    try {
      const res = await fetch("/api/recommend/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: last.id, rating: "none" }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setErr(t.undoFailed);
      setBusy(false);
      return;
    }

    // Reverse the correct counter — likes / dislikes / rated only — based
    // on the rating we recorded when this card was originally rated.
    const wasLikePositive = last.rating === "like" || last.rating === "superlike";
    const wasDislike = last.rating === "dislike" || last.rating === "strong_dislike";
    setHistory((h) => h.slice(0, -1));
    setCounts((c) => ({
      rated: Math.max(0, c.rated - 1),
      likes: Math.max(0, c.likes - (wasLikePositive ? 1 : 0)),
      dislikes: Math.max(0, c.dislikes - (wasDislike ? 1 : 0)),
    }));
    setDrag(null);
    setFlyOff(null);
    setComment("");
    setIdx((i) => Math.max(0, i - 1));
    setBusy(false);
  }

  async function generate() {
    setBusy(true);
    await fetch("/api/recommend/generate", { method: "POST" }).catch(() => {});
    router.refresh();
    setBusy(false);
  }

  // Keyboard shortcuts — works great on desktop, doesn't conflict with text
  // input because the comment box stops propagation by being a textarea.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack the comment textarea.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (busy || flyOff) return;
      switch (e.key) {
        case "ArrowRight":
        case "l":
        case "L":
          e.preventDefault();
          commit("like");
          break;
        case "ArrowLeft":
        case "h":
        case "H":
          e.preventDefault();
          commit("dislike");
          break;
        case "ArrowUp":
        case "k":
        case "K":
          e.preventDefault();
          commit("superlike");
          break;
        case "ArrowDown":
        case "j":
        case "J":
          e.preventDefault();
          commit("pass");
          break;
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "z":
        case "Z":
          e.preventDefault();
          undo();
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, flyOff, idx, history.length]);

  function onPointerDown(e: React.PointerEvent) {
    if (busy || flyOff) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }
  function onPointerUp() {
    const d = drag;
    dragStart.current = null;
    if (!d) return;
    if (d.y < -THRESHOLD && Math.abs(d.y) > Math.abs(d.x)) commit("superlike");
    else if (d.x > THRESHOLD) commit("like");
    else if (d.x < -THRESHOLD) commit("dislike");
    else setDrag(null);
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-12">
        <p className="text-neutral-400">{t.emptyNoRecs}</p>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-full bg-white px-6 py-2.5 font-semibold text-neutral-900 disabled:opacity-50"
        >
          {busy ? t.generating : t.generate}
        </button>
      </div>
    );
  }

  const hd = HEADER[current.recType] ?? HEADER.song;
  const tf = flyOff ?? drag ?? { x: 0, y: 0 };
  const transform = `translate(${tf.x}px, ${tf.y}px) rotate(${tf.x * 0.05}deg)`;
  const transition = flyOff
    ? "transform 0.3s ease-out"
    : drag
      ? "none"
      : "transform 0.25s ease-out";
  const dx = drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const likeOp = Math.max(0, Math.min(1, dx / THRESHOLD));
  const nopeOp = Math.max(0, Math.min(1, -dx / THRESHOLD));
  const superOp = Math.max(0, Math.min(1, -dy / THRESHOLD));
  const pct = current.score != null ? Math.round(current.score * 100) : null;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm text-neutral-500">
        {t.countsRated} {counts.rated} · 👍 {counts.likes} · 👎 {counts.dislikes}
      </p>

      {/* Rollback notice — appears when the server rejected the last
          rating / undo attempt. The card is still on screen because the
          optimistic state change was reverted; tapping Dismiss just
          hides the banner. */}
      {err && (
        <div
          role="alert"
          className="flex w-full max-w-sm items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-2 text-xs leading-relaxed text-amber-200"
        >
          <span aria-hidden>⚠</span>
          <span className="flex-1">{err}</span>
          <button
            onClick={() => setErr(null)}
            className="shrink-0 rounded px-1 py-0.5 text-amber-200/70 hover:bg-amber-900/40 hover:text-amber-100"
          >
            {t.dismiss}
          </button>
        </div>
      )}

      {/* card */}
      <div className="relative h-[min(33rem,62vh)] w-full max-w-sm select-none">
        <div className="absolute inset-x-3 top-3 bottom-0 rounded-2xl bg-white/5" />
        <div
          key={current.id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ transform, transition }}
          className="absolute inset-0 flex cursor-grab touch-none flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl active:cursor-grabbing"
        >
          {/* why-recommended strip */}
          <div className={`flex shrink-0 items-center gap-2 ${hd.bg} px-4 py-2.5 text-sm`}>
            <span>{hd.icon}</span>
            <span className={`shrink-0 font-medium ${hd.fg}`}>
              {HEADER_LABEL[current.recType] ?? HEADER_LABEL.song}
            </span>
            {/* When the recommender attached a seed track, prepend the
                connective ("via" / "기반:") so the chip reads as a
                sentence-continuation of the header label instead of a
                bare title that looks unrelated. */}
            {current.seedTrack && (
              <span className="ml-auto min-w-0 truncate rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300">
                {t.headerSeedPrefix} {current.seedTrack}
              </span>
            )}
            {current.recType === "song" && pct != null && (
              <span className="shrink-0 text-xs font-medium text-emerald-400">{pct}%</span>
            )}
          </div>

          {/* cover */}
          <div className="relative flex-1 bg-neutral-800">
            {current.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.coverUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900 to-rose-900 text-4xl">
                🎵
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent p-3">
              <h2 className="truncate text-lg font-bold">{current.title}</h2>
              <Link
                href={`/artist/${encodeURIComponent(current.artist)}`}
                onPointerDown={(e) => e.stopPropagation()}
                className="block truncate text-sm text-neutral-300 hover:text-white hover:underline"
              >
                {current.artist}
              </Link>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={togglePlay}
              disabled={!current.deezerId || loadingAudio}
              className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/60 text-base backdrop-blur disabled:opacity-40"
            >
              {loadingAudio ? "…" : playing ? "⏸" : "▶"}
            </button>
            <SwipeBadge op={likeOp} className="left-3 top-3 border-emerald-400 text-emerald-400">
              LIKE
            </SwipeBadge>
            <SwipeBadge op={nopeOp} className="right-3 top-3 border-rose-400 text-rose-400">
              NOPE
            </SwipeBadge>
            <SwipeBadge
              op={superOp}
              className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-sky-400 text-sky-400"
            >
              SUPER
            </SwipeBadge>
          </div>

        </div>
      </div>

      <DescriptionBlock key={current.id} rec={current} locale={locale} />

      <p className="text-xs text-neutral-600">{t.swipeHint}</p>

      {/* rating buttons */}
      <div className="flex items-center gap-3">
        <RateBtn onClick={() => commit("strong_dislike")} disabled={busy} title={t.rateStrongDislike} className="bg-rose-900">💔</RateBtn>
        <RateBtn onClick={() => commit("dislike")} disabled={busy} title={t.rateDislike} className="bg-rose-600">👎</RateBtn>
        <RateBtn onClick={() => commit("pass")} disabled={busy} title={t.ratePass} className="bg-neutral-700">⏭</RateBtn>
        <RateBtn onClick={() => commit("like")} disabled={busy} title={t.rateLike} className="bg-emerald-600">👍</RateBtn>
        <RateBtn onClick={() => commit("superlike")} disabled={busy} title={t.rateSuperlike} className="bg-sky-500">💖</RateBtn>
      </div>

      <div className="flex items-center gap-4 text-sm text-neutral-400">
        <button onClick={() => commit("known")} disabled={busy} className="hover:text-white disabled:opacity-40">
          {t.known}
        </button>
        <button
          onClick={undo}
          disabled={busy || history.length === 0}
          className="hover:text-white disabled:opacity-30"
        >
          {t.undo}
        </button>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t.commentPlaceholder}
        className="h-14 w-full max-w-sm resize-none rounded-lg border border-white/10 bg-white/5 p-2 text-sm outline-none"
      />
    </div>
  );
}

function SwipeBadge({
  op,
  className,
  children,
}: {
  op: number;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{ opacity: op }}
      className={`pointer-events-none absolute rounded-md border-2 px-2.5 py-0.5 text-base font-extrabold ${className}`}
    >
      {children}
    </span>
  );
}

function RateBtn({
  children,
  onClick,
  disabled,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lg transition active:scale-90 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** "Why this song matters" block. Renders the cached description if the
 *  server already has one, otherwise lazily POSTs to /api/recommend/describe
 *  on mount and shows the result. Hidden when Gemini returns nothing
 *  (rare niche tracks the model genuinely doesn't know) so the card
 *  doesn't show an empty container. */
function DescriptionBlock({ rec, locale }: { rec: Rec; locale: Locale }) {
  const [text, setText] = useState<string | null>(rec.description);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (text || loading) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/recommend/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rec.id }),
        });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as {
          description?: string | null;
          en?: string | null;
          ko?: string | null;
        };
        // Prefer locale-matched text when the endpoint returns both.
        const localed = locale === "ko" ? d.ko : d.en;
        const final = localed?.trim() || d.description?.trim() || null;
        if (!cancelled && final) setText(final);
      } catch {
        /* swallow — block stays hidden */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rec.id, locale, text, loading]);

  if (!text && !loading) return null;
  return (
    <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-neutral-300">
      {text ?? <span className="text-neutral-500">⋯</span>}
    </div>
  );
}
