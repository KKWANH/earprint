"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 30-second preview button.
 * Deezer preview URLs expire, so a fresh URL is fetched from /api/preview
 * right before playback.
 */
export function PreviewButton({ deezerId }: { deezerId: number | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stop and release the audio element when the component unmounts.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

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
      /* playback failed — ignore */
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
