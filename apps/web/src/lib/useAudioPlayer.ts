import { useEffect, useRef, useState } from "react";

/**
 * Plays a track's 30-second Deezer preview. The signed preview URL is fetched
 * fresh from /api/preview right before playback (the URLs expire). Switching
 * deezerId — or unmounting — stops and releases the previous audio.
 *
 * Shared by the library preview button and the recommendation card.
 */
export function useAudioPlayer(deezerId: number | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // Track changed (or component unmounting): release the previous audio.
  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [deezerId]);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }

  async function toggle() {
    if (!deezerId) return;
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

  return { playing, loading, toggle, stop };
}
