"use client";

import { useRef, useState } from "react";

/**
 * 30초 미리듣기 버튼.
 * Deezer preview URL 은 만료되므로 재생 직전 /api/preview 로 새 URL 을 받는다.
 */
export function PreviewButton({ deezerId }: { deezerId: number | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!deezerId) return null;

  async function toggle() {
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
    setLoading(true);
    try {
      const res = await fetch(`/api/preview?deezerId=${deezerId}`);
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
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      className="rounded px-1.5 text-xs text-neutral-400 hover:text-white"
      title="30초 미리듣기"
    >
      {loading ? "…" : playing ? "⏸" : "▶"}
    </button>
  );
}
