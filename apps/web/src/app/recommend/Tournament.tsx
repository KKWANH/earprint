"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface Rec {
  id: string;
  artist: string;
  title: string;
  album: string | null;
  coverUrl: string | null;
  deezerId: number | null;
  seedTrack: string | null;
  score: number | null;
  blurb: string | null;
}

type Rating = "superlike" | "like" | "pass" | "dislike" | "strong_dislike" | "known";

const THRESHOLD = 110; // px drag distance to commit a swipe

/**
 * Tinder-style recommendation rating — swipe right/left/up to like/dislike/super-like,
 * buttons for finer ratings, undo, optional comment.
 */
export function Tournament({
  initial,
  rated,
  likes,
  dislikes,
}: {
  initial: Rec[];
  rated: number;
  likes: number;
  dislikes: number;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flyOff, setFlyOff] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [counts, setCounts] = useState({ rated, likes, dislikes });
  const [history, setHistory] = useState<string[]>([]);
  const [blurbs, setBlurbs] = useState<Map<string, string>>(new Map());
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const current = initial[idx];

  useEffect(() => () => audioRef.current?.pause(), []);

  // Lazily fetch the history blurb for the current and next card.
  useEffect(() => {
    for (const rec of [initial[idx], initial[idx + 1]]) {
      if (!rec || rec.blurb || blurbs.has(rec.id)) continue;
      void fetch("/api/recommend/blurb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rec.id }),
      })
        .then((r) => r.json())
        .then((d: { blurb?: string }) => {
          if (d.blurb) setBlurbs((m) => new Map(m).set(rec.id, d.blurb as string));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

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
        ? { x: 600, y: 0 }
        : rating === "superlike"
          ? { x: 0, y: -700 }
          : rating === "dislike" || rating === "strong_dislike"
            ? { x: -600, y: 0 }
            : { x: 0, y: 600 };
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
    setShowComment(false);
    setDrag(null);
    setFlyOff(null);
    if (idx + 1 >= initial.length) {
      await fetch("/api/recommend/generate", { method: "POST" }).catch(() => {});
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
    else setDrag(null); // snap back
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-12">
        <p className="text-neutral-400">평가할 추천이 없어요.</p>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-full bg-white px-6 py-2.5 font-semibold text-neutral-900 disabled:opacity-50"
        >
          {busy ? "추천 만드는 중… (~10초)" : "추천 만들기"}
        </button>
      </div>
    );
  }

  const blurb = current.blurb ?? blurbs.get(current.id) ?? null;
  const t = flyOff ?? drag ?? { x: 0, y: 0 };
  const transform = `translate(${t.x}px, ${t.y}px) rotate(${t.x * 0.06}deg)`;
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

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm text-neutral-500">
        평가 {counts.rated} · 👍 {counts.likes} · 👎 {counts.dislikes}
      </p>

      {/* card stack */}
      <div className="relative h-[30rem] w-full max-w-sm select-none">
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
          {/* cover */}
          <div className="relative aspect-square w-full shrink-0 bg-neutral-800">
            {current.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.coverUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900 to-rose-900 text-5xl">
                🎵
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              <h2 className="truncate text-xl font-bold">{current.title}</h2>
              <p className="truncate text-neutral-300">{current.artist}</p>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={togglePlay}
              disabled={!current.deezerId || loadingAudio}
              className="absolute right-3 top-3 h-11 w-11 rounded-full bg-black/60 text-lg backdrop-blur disabled:opacity-40"
            >
              {loadingAudio ? "…" : playing ? "⏸" : "▶"}
            </button>

            {/* swipe hint badges */}
            <span
              style={{ opacity: likeOp }}
              className="absolute left-4 top-4 rounded-md border-2 border-emerald-400 px-3 py-1 text-lg font-extrabold text-emerald-400"
            >
              LIKE
            </span>
            <span
              style={{ opacity: nopeOp }}
              className="absolute right-4 top-16 rounded-md border-2 border-rose-400 px-3 py-1 text-lg font-extrabold text-rose-400"
            >
              NOPE
            </span>
            <span
              style={{ opacity: superOp }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-sky-400 px-3 py-1 text-lg font-extrabold text-sky-400"
            >
              SUPER
            </span>
          </div>

          {/* body */}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {current.score != null && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.round(current.score * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-medium text-emerald-400">
                  취향 적합도 {Math.round(current.score * 100)}%
                </span>
              </div>
            )}
            <p className="text-sm leading-relaxed text-neutral-300">
              {blurb ?? <span className="text-neutral-600">곡 이야기 불러오는 중…</span>}
            </p>
            {current.seedTrack && (
              <p className="mt-auto pt-2 text-xs text-neutral-600">
                💡 좋아한 「{current.seedTrack}」 에서 추천
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-600">← 별로 · → 좋아요 · ↑ 정말 좋아요 로 스와이프</p>

      {/* rating buttons */}
      <div className="flex items-center gap-3">
        <RateBtn onClick={() => commit("strong_dislike")} disabled={busy} title="정말 별로" className="bg-rose-900 text-xl">💔</RateBtn>
        <RateBtn onClick={() => commit("dislike")} disabled={busy} title="별로" className="bg-rose-600 text-2xl">👎</RateBtn>
        <RateBtn onClick={() => commit("pass")} disabled={busy} title="패스" className="bg-neutral-700 text-xl">⏭</RateBtn>
        <RateBtn onClick={() => commit("like")} disabled={busy} title="좋아요" className="bg-emerald-600 text-2xl">👍</RateBtn>
        <RateBtn onClick={() => commit("superlike")} disabled={busy} title="정말 좋아요" className="bg-sky-500 text-xl">💖</RateBtn>
      </div>

      <div className="flex items-center gap-4 text-sm text-neutral-400">
        <button onClick={() => commit("known")} disabled={busy} className="hover:text-white disabled:opacity-40">
          이미 아는 곡
        </button>
        <button
          onClick={() => setShowComment((s) => !s)}
          className="hover:text-white"
        >
          💬 코멘트
        </button>
        <button
          onClick={undo}
          disabled={busy || history.length === 0}
          className="hover:text-white disabled:opacity-30"
        >
          ↩ 되돌리기
        </button>
      </div>

      {showComment && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="이 곡에 대한 메모 (선택) — 평가와 함께 저장됩니다"
          className="h-16 w-full max-w-sm resize-none rounded-lg border border-white/10 bg-white/5 p-2 text-sm outline-none"
        />
      )}
    </div>
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
      className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition active:scale-90 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
