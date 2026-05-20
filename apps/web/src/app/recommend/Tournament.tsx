"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface Rec {
  id: string;
  artist: string;
  title: string;
  album: string | null;
  deezerId: number | null;
  seedTrack: string | null;
}

type Rating = "like" | "dislike" | "pass";

/** 추천 평가 — 한 곡씩 카드로 보여주고 좋아요/별로/패스 + 코멘트. */
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
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ rated, likes, dislikes });
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = initial[idx];

  /** 카드 전환 시 — 재생 중지 + 오디오 폐기. */
  function resetAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }

  /** Deezer preview URL 은 만료되므로 재생 직전에 새로 받는다. */
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
      /* 재생 실패 — 무시 */
    }
    setLoadingAudio(false);
  }

  async function generate() {
    setBusy(true);
    await fetch("/api/recommend/generate", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  async function rate(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
    resetAudio();
    await fetch("/api/recommend/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, rating, comment }),
    });
    setCounts((c) => ({
      rated: c.rated + 1,
      likes: c.likes + (rating === "like" ? 1 : 0),
      dislikes: c.dislikes + (rating === "dislike" ? 1 : 0),
    }));
    setComment("");
    if (idx + 1 >= initial.length) {
      await fetch("/api/recommend/generate", { method: "POST" });
      router.refresh();
      setBusy(false);
      return;
    }
    setIdx(idx + 1);
    setBusy(false);
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-12">
        <p className="text-neutral-400">평가할 추천이 없습니다.</p>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-white px-5 py-2 font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? "추천 생성 중… (~10초)" : "추천 생성하기"}
        </button>
      </div>
    );
  }

  const ytSearch = `https://music.youtube.com/search?q=${encodeURIComponent(
    `${current.artist} ${current.title}`,
  )}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        평가 {counts.rated} · 👍 {counts.likes} · 👎 {counts.dislikes}
      </p>

      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
        <div>
          <h2 className="text-2xl font-bold">{current.title}</h2>
          <p className="text-lg text-neutral-400">{current.artist}</p>
          {current.album && <p className="text-sm text-neutral-600">{current.album}</p>}
        </div>

        {current.seedTrack && (
          <p className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-400">
            💡 좋아한{" "}
            <strong className="text-neutral-200">{current.seedTrack}</strong> 와(과)
            비슷해서 추천했어요
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!current.deezerId || loadingAudio}
            className="rounded-full bg-white px-5 py-2 font-medium text-neutral-900 disabled:opacity-40"
          >
            {loadingAudio ? "불러오는 중…" : playing ? "⏸ 정지" : "▶ 30초 미리듣기"}
          </button>
          <a
            href={ytSearch}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-neutral-400 underline hover:text-white"
          >
            YouTube Music 에서 전곡 듣기 ↗
          </a>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="별로라면 이유를 남겨주세요 (선택) — 추천 개선에 쓰입니다"
          className="h-16 resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-sm outline-none"
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => rate("dislike")}
            disabled={busy}
            className="rounded-lg bg-rose-600 py-3 font-medium disabled:opacity-50"
          >
            👎 별로
          </button>
          <button
            onClick={() => rate("pass")}
            disabled={busy}
            className="rounded-lg bg-neutral-700 py-3 font-medium disabled:opacity-50"
          >
            ⏭ 패스
          </button>
          <button
            onClick={() => rate("like")}
            disabled={busy}
            className="rounded-lg bg-emerald-600 py-3 font-medium disabled:opacity-50"
          >
            👍 좋아요
          </button>
        </div>
      </div>
    </div>
  );
}
