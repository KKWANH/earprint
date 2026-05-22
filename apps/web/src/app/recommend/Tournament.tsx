"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { recommendDict } from "@/lib/i18n/recommend";

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
  const [history, setHistory] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const prefetch = useRef<Promise<unknown> | null>(null);

  const current = initial[idx];

  useEffect(() => () => audioRef.current?.pause(), []);

  // Generate the next batch a few cards early — by the time the user reaches
  // the end it is ready, so there is no ~10s wait.
  useEffect(() => {
    if (idx >= initial.length - 5 && !prefetch.current) {
      prefetch.current = fetch("/api/recommend/generate", { method: "POST" }).catch(
        () => {},
      );
    }
  }, [idx, initial.length]);

  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }

  async function togglePlay() {
    if (!current?.deezerId) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (audioRef.current) {
      void audioRef.current.play();
      setPlaying(true);
      return;
    }
    setLoadingAudio(true);
    try {
      const res = await fetch(`/api/preview?deezerId=${current.deezerId}`);
      const d = (await res.json()) as { url?: string };
      if (d.url) {
        const a = new Audio(d.url);
        a.onended = () => setPlaying(false);
        audioRef.current = a;
        void a.play();
        setPlaying(true);
      }
    } catch {
      /* playback failed — ignore */
    }
    setLoadingAudio(false);
  }

  async function commit(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
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
    await fetch("/api/recommend/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, rating, comment }),
    }).catch(() => {});
    setHistory((h) => [...h, current.id]);
    setCounts((c) => ({
      rated: c.rated + 1,
      likes: c.likes + (rating === "like" || rating === "superlike" ? 1 : 0),
      dislikes: c.dislikes + (rating === "dislike" || rating === "strong_dislike" ? 1 : 0),
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
    stopAudio();
    const lastId = history[history.length - 1];
    await fetch("/api/recommend/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lastId, rating: "none" }),
    }).catch(() => {});
    setHistory((h) => h.slice(0, -1));
    setCounts((c) => ({ ...c, rated: Math.max(0, c.rated - 1) }));
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
            {current.seedTrack && (
              <span className="ml-auto min-w-0 truncate rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300">
                {current.seedTrack}
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
              <p className="truncate text-sm text-neutral-300">{current.artist}</p>
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
