import { useEffect, useRef, useState } from "react";

/**
 * Plays a track's 30-second Deezer preview. The signed preview URL is fetched
 * fresh from /api/preview right before playback (the URLs expire). Switching
 * deezerId — or unmounting — stops and releases the previous audio.
 *
 * Shared by the library preview button, the recommendation card, and the
 * worldcup bracket.
 *
 * Error handling: HTMLMediaElement.play() returns a Promise that REJECTS
 * with `NotSupportedError` when the source URL is dead / wrong format /
 * blocked by the browser's autoplay policy. The previous `void a.play()`
 * pattern dropped that rejection onto the global error handler, which
 * is what showed up in production as
 *   "Uncaught (in promise) NotSupportedError: The element has no
 *    supported sources."
 * We now await + catch, set an `error` flag the UI can render as
 * "Preview unavailable" instead of leaving the play button hanging.
 */
export function useAudioPlayer(deezerId: number | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Track changed (or component unmounting): release the previous audio.
  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    setError(false);
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
    // Re-use an existing element when the same track is replayed —
    // the audio is already loaded, just resume. Still need to await the
    // play() Promise so any AbortError / NotAllowedError surfaces here
    // instead of bubbling out as an Unhandled Promise Rejection.
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setError(true);
      }
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/preview?deezerId=${deezerId}`);
      const d = (await res.json()) as { url?: string };
      if (!d.url) {
        setError(true);
        return;
      }
      const a = new Audio(d.url);
      a.onended = () => setPlaying(false);
      // onerror covers loading failures (404 / CORS / unsupported mime)
      // that fire BEFORE play() — the element emits "error" and rejects
      // the play() Promise. Set the flag from both spots to be safe.
      a.onerror = () => {
        setError(true);
        setPlaying(false);
      };
      audioRef.current = a;
      try {
        await a.play();
        setPlaying(true);
      } catch {
        // NotSupportedError / NotAllowedError / AbortError all funnel
        // here. Don't surface the error class to the UI — the user
        // doesn't need it; "Preview unavailable" is the right signal.
        setError(true);
        audioRef.current = null;
      }
    } catch {
      // /api/preview fetch failed (network / 5xx) — treat as unavailable.
      setError(true);
    }
    setLoading(false);
  }

  return { playing, loading, error, toggle, stop };
}
