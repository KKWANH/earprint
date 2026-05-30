"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { accountDict } from "@/lib/i18n/account";
import { SpotifyPlaylistPicker } from "./SpotifyPlaylistPicker";

/**
 * Client widget for the Spotify side of the library page. Three
 * visual states:
 *
 *   - not connected: "Connect Spotify" button that GETs /api/auth/
 *     spotify/start (the route 302s out to Spotify's authorize page).
 *   - connected, not syncing: "Sync now" + "Disconnect" + the
 *     "Last synced <relative>" line.
 *   - syncing: progress spinner + "Cancel" hidden (the sync runs
 *     server-side, the button just disables itself).
 *
 * After a sync completes, we router.refresh() so the per-user
 * counts on the rest of the page (analyze panel, stats cards) pick
 * up the new rows without a full reload.
 *
 * Read-only initial state comes from a tiny /api/spotify/status
 * endpoint (cheap: SELECT one row). We could SSR it but the page
 * is already doing several queries; one async client fetch keeps
 * the SSR critical-path narrow.
 */
interface SpotifyStatus {
  connected: boolean;
  lastSyncedAt: string | null;
  scope: string | null;
  /** R31a — operator kill-switch. False when the Spotify integration
   *  is disabled at the env level (SPOTIFY_ENABLED=false), e.g. while
   *  the Premium subscription hasn't propagated yet. */
  featureEnabled: boolean;
  /** R33 — optional ISO datetime for when the operator expects the
   *  integration to be live (set after subscribing to Premium so
   *  users see a countdown rather than a static "준비 중"). */
  enableEta: string | null;
}

export function SpotifyConnectCard({ locale }: { locale: Locale }) {
  const ko = locale === "ko";
  const t = accountDict(locale);
  const router = useRouter();
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // R36 — sessionStorage 5-minute cache so we don't re-hit
  // /api/spotify/status on every /library render (the user often
  // re-visits /library across the session — sync now, browse
  // genres, come back). Cache invalidates on sync / disconnect
  // (those code paths write null to evict).
  const CACHE_KEY = "earprint.spotify.status";
  const CACHE_TTL_MS = 5 * 60_000;

  const refresh = useCallback(async (skipCache = false) => {
    if (!skipCache && typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            at: number;
            data: SpotifyStatus;
          };
          if (Date.now() - parsed.at < CACHE_TTL_MS) {
            setStatus(parsed.data);
            return;
          }
        }
      } catch {
        /* corrupted cache — fall through to refetch */
      }
    }
    try {
      const res = await fetch("/api/spotify/status");
      if (res.ok) {
        const data = (await res.json()) as SpotifyStatus;
        setStatus(data);
        try {
          window.sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ at: Date.now(), data }),
          );
        } catch {
          /* storage blocked — non-fatal */
        }
      }
    } catch {
      /* leave status null; the card will render the connect button anyway */
    }
  }, []);

  // Helper for cache-busting paths (sync / disconnect).
  const invalidateAndRefresh = useCallback(async () => {
    try {
      window.sessionStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    await refresh(true);
  }, [refresh]);

  // On mount: load status. Also re-read on a callback redirect by
  // peeking at the URL for our "?spotify=connected" sentinel from
  // /api/auth/spotify/callback.
  useEffect(() => {
    void refresh();
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      const s = q.get("spotify");
      if (s === "connected") {
        setResult(t.spotifyConnectedToast);
        // Strip the param so a refresh doesn't re-show the toast.
        q.delete("spotify");
        q.delete("reason");
        const next =
          window.location.pathname + (q.toString() ? `?${q}` : "");
        window.history.replaceState({}, "", next);
      } else if (s === "error") {
        const reason = q.get("reason") ?? "unknown";
        // Map the most-likely reason codes to actionable hints. R28a
        // introduced the granular identify-* codes so the UI can be
        // specific instead of just saying "unknown".
        const hint = (() => {
          if (reason === "feature-disabled") {
            // R31a — kill-switch flipped off mid-flow (e.g. user
            // clicked Connect right before operator disabled).
            return t.spotifyErrFeatureDisabled;
          }
          if (reason === "identify-403-premium") {
            // Spotify rolled out a new Dev Mode restriction in late
            // 2024: the app OWNER must have an active Premium
            // subscription, regardless of who's signing in. This
            // applies even to read-only scopes like /me. Workarounds:
            //   1) Owner gets Premium (~$10/mo)
            //   2) Apply for Extended Quota Mode (production
            //      approval, takes 2-4 weeks)
            return t.spotifyErr403Premium;
          }
          if (reason === "identify-403-dev-mode") {
            return t.spotifyErr403DevMode;
          }
          if (reason === "identify-401-token") {
            return t.spotifyErr401Token;
          }
          if (reason === "bad-state") {
            return t.spotifyErrBadState;
          }
          if (reason === "no-refresh-token") {
            return t.spotifyErrNoRefreshToken;
          }
          return t.spotifyErrReason(reason);
        })();
        setError(t.spotifyConnectionFailed + hint);
        q.delete("spotify");
        q.delete("reason");
        const next =
          window.location.pathname + (q.toString() ? `?${q}` : "");
        window.history.replaceState({}, "", next);
      }
    }
  }, [refresh, ko]);

  async function sync() {
    if (busy) return;
    setBusy("sync");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/spotify/sync", { method: "POST" });
      // R27a expanded the sync result shape from a single liked-songs
      // summary into a 4-section breakdown (liked + top + recent +
      // playlist count). Surface them in the toast so the user can
      // see what worked even if one path failed.
      interface SyncSection {
        added?: number;
        scanned?: number;
        more?: boolean;
        error?: string | null;
      }
      const d = (await res.json()) as {
        ok?: boolean;
        liked?: SyncSection;
        top?: SyncSection;
        topArtists?: { added?: number; error?: string | null };
        recent?: SyncSection;
        playlists?: { count?: number; error?: string | null };
        autoSync?: { triggered?: number; addedTotal?: number; error?: string | null };
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      const liked = d.liked?.added ?? 0;
      const top = d.top?.added ?? 0;
      const topA = d.topArtists?.added ?? 0;
      const recent = d.recent?.added ?? 0;
      const auto = d.autoSync?.addedTotal ?? 0;
      const more = d.liked?.more ? t.spotifySyncMore : "";
      // R28b adds top artists + auto-resync of opted-in playlists
      // to the summary. Keep it on one line for compactness; the
      // numbers most users care about (added counts) are still there.
      const autoNote = auto > 0 ? t.spotifySyncPlaylistsAuto(auto) : "";
      setResult(
        t.spotifySyncSummary(liked, top, topA, recent, autoNote, more),
      );
      // Refresh server data so the per-user stats pick up the new rows.
      // Cache-bust so the next /library visit picks up the new
      // last_synced_at instead of the stale sessionStorage entry.
      router.refresh();
      await invalidateAndRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (busy) return;
    if (!window.confirm(t.spotifyDisconnectConfirm)) {
      return;
    }
    setBusy("disconnect");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/auth/spotify/disconnect", { method: "POST" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      await invalidateAndRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  // Status still loading — render a thin placeholder so the page's
  // layout doesn't jump once it resolves.
  if (status === null) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-5 text-xs text-neutral-500">
        Spotify…
      </section>
    );
  }

  // R31a — feature flag off (operator hasn't enabled SPOTIFY_ENABLED
  // yet, typically because Premium subscription is pending). Render
  // a soft "준비 중" card instead of the active connect button so
  // users see why the feature is unavailable. R33 — when operator
  // sets SPOTIFY_ENABLE_ETA, swap the static hint for a live
  // countdown so the user can see "auto-activates in 3h".
  if (!status.featureEnabled) {
    const eta = status.enableEta ? new Date(status.enableEta) : null;
    const etaCountdown = eta
      ? formatCountdown(eta, ko)
      : null;
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-700 bg-neutral-900/50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-400">
            {t.spotifyComingSoonTitle}
          </h2>
          <span className="text-[10px] text-neutral-600">{t.spotifyVersionTag}</span>
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          {t.spotifyComingSoonDesc}
        </p>
        {etaCountdown && (
          <p className="text-xs text-amber-300">
            ⏱ {etaCountdown}
          </p>
        )}
        <button
          type="button"
          disabled
          className="self-start rounded-md bg-neutral-700/40 px-4 py-2 text-sm font-semibold text-neutral-500 cursor-not-allowed"
        >
          {t.spotifyComingSoonButton}
        </button>
      </section>
    );
  }

  if (!status.connected) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-[#1DB954]/30 bg-gradient-to-br from-[#1DB954]/10 via-neutral-950 to-neutral-900 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#1DB954]">
            {t.spotifyConnectTitle}
          </h2>
          <span className="text-[10px] text-neutral-600">{t.spotifyVersionTag}</span>
        </div>
        <p className="text-xs leading-relaxed text-neutral-400">
          {t.spotifyConnectDesc}
        </p>
        <a
          href="/api/auth/spotify/start"
          className="self-start rounded-md bg-[#1DB954] px-4 py-2 text-sm font-semibold text-black hover:bg-[#1ed760]"
        >
          {t.spotifyConnectButton}
        </a>
        {error && (
          <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
      </section>
    );
  }

  // Connected view.
  const last = status.lastSyncedAt ? new Date(status.lastSyncedAt) : null;
  const relative = last ? relativeTime(last, ko) : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#1DB954]/30 bg-gradient-to-br from-[#1DB954]/10 via-neutral-950 to-neutral-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#1DB954]">
          {t.spotifyConnectedTitle}
        </h2>
        {last && (
          <span className="text-[11px] text-neutral-500">
            {t.spotifyLastSynced}
            {relative}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void sync()}
          disabled={busy !== null}
          className="rounded-md bg-[#1DB954] px-4 py-2 text-sm font-semibold text-black hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "sync" ? t.spotifySyncing : t.spotifySyncNow}
        </button>
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={busy !== null}
          className="rounded-md border border-white/10 px-3 py-2 text-xs text-neutral-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "disconnect" ? "…" : t.spotifyDisconnect}
        </button>
      </div>
      {result && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
          {result}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {/* Playlist picker — lazy-loads its data on expand so we don't
          hit /me/playlists on every /library render. R27b. */}
      <SpotifyPlaylistPicker ko={ko} />
    </section>
  );
}

/** R33 — countdown formatter for SPOTIFY_ENABLE_ETA. Returns
 *  "auto-activates in 2h 30m" style strings. When the ETA is in the
 *  past, shifts to "should be live any moment" — Spotify Premium
 *  activation typically takes a few hours after subscription so a
 *  small overshoot is normal. */
function formatCountdown(eta: Date, ko: boolean): string {
  const t = accountDict(ko ? "ko" : "en");
  const diff = eta.getTime() - Date.now();
  if (diff <= 0) {
    return t.spotifyCountdownLivePast;
  }
  const totalMin = Math.floor(diff / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(t.spotifyCountdownDays(days));
  if (hours > 0) parts.push(t.spotifyCountdownHours(hours));
  if (mins > 0 && days === 0) parts.push(t.spotifyCountdownMins(mins));
  const remain = parts.length > 0 ? parts.join(" ") : t.spotifyCountdownSoon;
  return t.spotifyCountdownAuto(remain);
}

/** Tiny "5 minutes ago" formatter; tossed inline because it's only
 *  used here and not worth a separate util. */
function relativeTime(d: Date, ko: boolean): string {
  const t = accountDict(ko ? "ko" : "en");
  const diffSec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return t.spotifyRelJustNow;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return t.spotifyRelMinAgo(min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return t.spotifyRelHrAgo(hr);
  const day = Math.floor(hr / 24);
  return t.spotifyRelDayAgo(day);
}
