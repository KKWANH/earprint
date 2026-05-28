"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

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
        setError(
          (ko ? "Spotify 연결 실패: " : "Spotify connection failed: ") +
            (q.get("reason") ?? "unknown"),
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
      const d = (await res.json()) as {
        ok?: boolean;
        added?: number;
        skipped?: number;
        scanned?: number;
        reachedMaxPages?: boolean;
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      const added = d.added ?? 0;
      const scanned = d.scanned ?? 0;
      const more = d.reachedMaxPages
        ? ko
          ? " (더 가져올 게 있어요 — 다시 누르면 이어서)"
          : " (more to fetch — click again to continue)"
        : "";
      setResult(
        ko
          ? `${added}곡 추가 · ${scanned}곡 검사${more}`
          : `+${added} new of ${scanned} scanned${more}`,
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
