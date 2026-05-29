"use client";

import { useEffect } from "react";

/**
 * R39 (EC-3) — fire-once view counter. Replaces the old server-side
 * increment that ran on every SSR render (inflated by bots + the
 * owner's repeat visits). Bots don't run JS, so this naturally
 * excludes crawlers; a per-session sessionStorage guard dedups a
 * user's repeat visits within the same tab session.
 *
 * Best-effort: failures are swallowed (a vanity counter isn't worth
 * surfacing an error). Doesn't render anything.
 */
export function GenreViewPing({ genre }: { genre: string }) {
  useEffect(() => {
    const key = `gv:${genre.toLowerCase()}`;
    try {
      if (sessionStorage.getItem(key)) return; // already counted this session
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blocked (private mode) — still ping once,
      // just without the dedup guard.
    }
    void fetch("/api/genre/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genre }),
      keepalive: true,
    }).catch(() => {});
  }, [genre]);
  return null;
}
