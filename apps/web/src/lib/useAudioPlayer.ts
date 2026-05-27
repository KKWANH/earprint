import { useEffect, useRef, useState } from "react";

/**
 * Plays a track's 30-second Deezer preview. The signed preview URL is fetched
 * fresh from /api/preview right before playback (the URLs expire). Switching
 * deezerId — or unmounting — stops and releases the previous audio.
 *
 * Shared by the library preview button, the recommendation card, and the
 * worldcup bracket.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Error handling — why this is fiddly:
 *
 *   "Uncaught (in promise) NotSupportedError: The element has no
 *    supported sources."
 *
 * This message shows up as an Unhandled Promise Rejection in DevTools
 * even when callers don't think they're awaiting anything. Three
 * sources combine to leak it; the previous fix only closed one:
 *
 *   1. `new Audio(url)` sets `src` synchronously inside the constructor,
 *      so a 404 / mime mismatch can emit the native `error` event in
 *      the SAME tick — BEFORE the line where we assign `a.onerror`.
 *      Fix: construct an empty Audio(), attach `onerror` FIRST, then
 *      assign `.src`.
 *
 *   2. The cleanup effect paused the old element but did NOT clear
 *      its `src`, so a pending load triggered by a previous `toggle()`
 *      could fire `error` after unmount — into a handler whose React
 *      state is gone, surfacing as an unhandled exception. Fix: clear
 *      `src` + call `.load()` in cleanup to cancel any pending fetch.
 *
 *   3. `toggle` is an async function. Even with internal try/catch on
 *      every `await`, ANY synchronous throw above the awaits (e.g. a
 *      browser policy error on `new Audio()`) escapes as a rejected
 *      promise. React's `onClick={toggle}` passes that promise to the
 *      void, which DevTools then reports as Unhandled. Fix: wrap the
 *      entire body in one outer try/catch so toggle() can NEVER
 *      reject.
 *
 * UI surface: callers should render an "Preview unavailable" affordance
 * when `error === true` rather than a play button — there is no
 * workable preview for that track.
 */
export function useAudioPlayer(deezerId: number | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Track changed (or component unmounting): release the previous audio.
  // Critically, we ALSO have to detach event handlers and clear src —
  // otherwise a pending HTTP load can still emit `error` after this
  // hook has gone, and the handler closure references stale React state.
  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    setError(false);
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.onended = null;
        a.onerror = null;
        // Removing src + load() actively cancels any in-flight network
        // request the element started — prevents the late `error` event
        // that the previous version was emitting into the void.
        a.removeAttribute("src");
        try {
          a.load();
        } catch {
          /* load() can throw on some browsers when src is empty; we don't care */
        }
      }
      audioRef.current = null;
    };
  }, [deezerId]);

  function stop() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.onended = null;
      a.onerror = null;
      a.removeAttribute("src");
      try { a.load(); } catch { /* ignore */ }
    }
    audioRef.current = null;
    setPlaying(false);
  }

  async function toggle() {
    if (!deezerId) return;

    // OUTER try/catch — this is the safety net that guarantees toggle()
    // never rejects, no matter what goes wrong inside. Without it, any
    // sync throw above an `await` (or a thrown sync exception from
    // `new Audio()`, `pause()`, etc.) escapes to React's onClick and
    // shows up as "Uncaught (in promise) NotSupportedError" in DevTools.
    try {
      if (playing) {
        audioRef.current?.pause();
        setPlaying(false);
        return;
      }

      // Re-use an existing element when the same track is replayed.
      // Skip reuse if src was cleared (cleanup ran but the ref outlived) —
      // otherwise we'd .play() an audio with no source and get the very
      // error this hook exists to prevent.
      if (audioRef.current && audioRef.current.src) {
        try {
          await audioRef.current.play();
          setPlaying(true);
        } catch {
          setError(true);
          audioRef.current = null;
        }
        return;
      }

      setLoading(true);
      setError(false);

      let url: string | undefined;
      try {
        const res = await fetch(`/api/preview?deezerId=${deezerId}`);
        const d = (await res.json()) as { url?: string };
        url = d.url;
      } catch {
        // network / 5xx — handled below at the !url check
      }
      if (!url) {
        setError(true);
        setLoading(false);
        return;
      }

      // CRITICAL: attach error handler BEFORE assigning src. The native
      // `error` event fires synchronously for some failure modes (bad
      // codec, blocked CORS), and `new Audio(url)` sets the src inside
      // the constructor — so the previous order silently lost early
      // errors. Empty constructor + ordered attach + .src= is the only
      // pattern where the handler is guaranteed to catch every error.
      const a = new Audio();
      a.preload = "auto";
      a.onended = () => setPlaying(false);
      a.onerror = () => {
        setError(true);
        setPlaying(false);
      };
      a.src = url;
      audioRef.current = a;

      try {
        await a.play();
        setPlaying(true);
      } catch {
        // NotSupportedError / NotAllowedError / AbortError funnel here.
        // The class isn't useful to the UI — "Preview unavailable" is.
        setError(true);
        audioRef.current = null;
      }
      setLoading(false);
    } catch {
      // Final guard: any unexpected sync throw lands here and we surface
      // it as a generic error instead of letting the promise reject.
      setError(true);
      setLoading(false);
      setPlaying(false);
      audioRef.current = null;
    }
  }

  return { playing, loading, error, toggle, stop };
}
