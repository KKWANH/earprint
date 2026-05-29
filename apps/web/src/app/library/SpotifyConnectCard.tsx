"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
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
}

export function SpotifyConnectCard({ locale }: { locale: Locale }) {
  const ko = locale === "ko";
  const router = useRouter();
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/status");
      if (res.ok) setStatus((await res.json()) as SpotifyStatus);
    } catch {
      /* leave status null; the card will render the connect button anyway */
    }
  }, []);

  // On mount: load status. Also re-read on a callback redirect by
  // peeking at the URL for our "?spotify=connected" sentinel from
  // /api/auth/spotify/callback.
  useEffect(() => {
    void refresh();
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      const s = q.get("spotify");
      if (s === "connected") {
        setResult(ko ? "Spotify 연결됨." : "Spotify connected.");
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
            return ko
              ? "Spotify 통합이 일시 비활성화돼있어요. 운영자가 재활성화하면 다시 시도할 수 있어요."
              : "Spotify integration is temporarily disabled. Will be re-enabled by the operator when ready.";
          }
          if (reason === "identify-403-premium") {
            // Spotify rolled out a new Dev Mode restriction in late
            // 2024: the app OWNER must have an active Premium
            // subscription, regardless of who's signing in. This
            // applies even to read-only scopes like /me. Workarounds:
            //   1) Owner gets Premium (~$10/mo)
            //   2) Apply for Extended Quota Mode (production
            //      approval, takes 2-4 weeks)
            return ko
              ? "Spotify가 최근에 정책 바꿨어요 — 앱 소유자가 Spotify Premium 구독자여야 합니다. 가입 후 몇 시간 뒤 자동 활성화. 또는 Spotify Dashboard에서 'Extended Quota Mode'를 신청하면 영구 무료 (검토 2-4주)."
              : "Spotify recently changed their dev-mode policy: the app owner must have an active Premium subscription. Auto-activates a few hours after subscribing. Alternative: request 'Extended Quota Mode' from Spotify (free, but takes 2-4 weeks for review).";
          }
          if (reason === "identify-403-dev-mode") {
            return ko
              ? "Spotify 앱이 개발 모드여서 본인 계정이 User 리스트에 없을 때 발생합니다. Spotify Dashboard → User Management 에서 본인 Spotify 가입 이메일을 추가해 주세요."
              : "Spotify app is still in Development Mode and the signing-in account isn't on the user allowlist. Add your Spotify account email at Spotify Dashboard → User Management.";
          }
          if (reason === "identify-401-token") {
            return ko
              ? "토큰 교환은 됐는데 액세스 토큰이 거부됐어요. SPOTIFY_CLIENT_SECRET 이 정확히 박혀있는지 확인해 주세요."
              : "Token exchange succeeded but the access token was rejected. Re-check SPOTIFY_CLIENT_SECRET.";
          }
          if (reason === "bad-state") {
            return ko
              ? "CSRF 보호 쿠키 만료. 5분 안에 동의를 완료해 주세요."
              : "CSRF cookie expired — finish the consent within 5 minutes.";
          }
          if (reason === "no-refresh-token") {
            return ko
              ? "Spotify가 refresh token을 안 줬어요. show_dialog 설정 확인이 필요합니다."
              : "Spotify didn't return a refresh token.";
          }
          return ko
            ? `이유: ${reason}`
            : `Reason: ${reason}`;
        })();
        setError(
          (ko ? "Spotify 연결 실패. " : "Spotify connection failed. ") + hint,
        );
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
      const more = d.liked?.more
        ? ko
          ? " (더 가져올 게 있어요 — 다시 누르면 이어서)"
          : " (more liked songs — click again to continue)"
        : "";
      // R28b adds top artists + auto-resync of opted-in playlists
      // to the summary. Keep it on one line for compactness; the
      // numbers most users care about (added counts) are still there.
      const autoNote = auto > 0
        ? ko ? ` · 플리 자동 +${auto}` : ` · playlists +${auto}`
        : "";
      setResult(
        ko
          ? `좋아요 ${liked}곡 · TOP ${top}곡 · 아티스트 ${topA} · 최근재생 ${recent}곡${autoNote}${more}`
          : `${liked} liked · ${top} top · ${topA} artists · ${recent} recent${autoNote}${more}`,
      );
      // Refresh server data so the per-user stats pick up the new rows.
      router.refresh();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (busy) return;
    if (
      !window.confirm(
        ko
          ? "Spotify 연결을 해제할까요? 가져온 곡은 그대로 남아있어요."
          : "Disconnect Spotify? Already-imported tracks stay in your library.",
      )
    ) {
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
      await refresh();
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
  // users see why the feature is unavailable.
  if (!status.featureEnabled) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-700 bg-neutral-900/50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-400">
            {ko ? "Spotify 연결 (준비 중)" : "Spotify (coming soon)"}
          </h2>
          <span className="text-[10px] text-neutral-600">v0 · Liked Songs only</span>
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          {ko
            ? "Spotify가 최근에 정책 바꿔서, 우리 쪽 인증을 풀려면 앱 소유자가 Spotify Premium 구독자여야 합니다. 활성화되면 여기서 연결할 수 있어요."
            : "Spotify recently changed their dev-mode policy — the app owner needs an active Premium subscription to unblock our auth. Will be enabled here when ready."}
        </p>
        <button
          type="button"
          disabled
          className="self-start rounded-md bg-neutral-700/40 px-4 py-2 text-sm font-semibold text-neutral-500 cursor-not-allowed"
        >
          {ko ? "🚧 준비 중" : "🚧 Coming soon"}
        </button>
      </section>
    );
  }

  if (!status.connected) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-[#1DB954]/30 bg-gradient-to-br from-[#1DB954]/10 via-neutral-950 to-neutral-900 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#1DB954]">
            {ko ? "Spotify 연결" : "Connect Spotify"}
          </h2>
          <span className="text-[10px] text-neutral-600">v0 · Liked Songs only</span>
        </div>
        <p className="text-xs leading-relaxed text-neutral-400">
          {ko
            ? "Spotify 좋아요(❤) 곡을 라이브러리에 합칩니다. YT Music과 같은 곡은 중복 제거됨. 읽기 전용 — Earprint가 Spotify 쪽에 아무것도 안 씁니다."
            : "Pulls your Spotify Liked Songs into your library. Tracks already liked on YT Music dedup at the canonical level. Read-only — Earprint writes nothing back to Spotify."}
        </p>
        <a
          href="/api/auth/spotify/start"
          className="self-start rounded-md bg-[#1DB954] px-4 py-2 text-sm font-semibold text-black hover:bg-[#1ed760]"
        >
          {ko ? "Spotify 로 연결" : "Connect with Spotify"}
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
          {ko ? "Spotify 연결됨" : "Spotify connected"}
        </h2>
        {last && (
          <span className="text-[11px] text-neutral-500">
            {ko ? "마지막 동기화 " : "Last synced "}
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
          {busy === "sync"
            ? ko ? "가져오는 중…" : "Syncing…"
            : ko ? "지금 동기화" : "Sync now"}
        </button>
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={busy !== null}
          className="rounded-md border border-white/10 px-3 py-2 text-xs text-neutral-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "disconnect"
            ? "…"
            : ko ? "연결 해제" : "Disconnect"}
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

/** Tiny "5 minutes ago" formatter; tossed inline because it's only
 *  used here and not worth a separate util. */
function relativeTime(d: Date, ko: boolean): string {
  const diffSec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return ko ? "방금 전" : "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60)
    return ko ? `${min}분 전` : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)
    return ko ? `${hr}시간 전` : `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return ko ? `${day}일 전` : `${day} day${day === 1 ? "" : "s"} ago`;
}
