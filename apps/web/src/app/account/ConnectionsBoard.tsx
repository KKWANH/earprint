"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";

/**
 * R34 — single-panel "Connections" board that consolidates the
 * three identity / data sources Earprint actually uses:
 *
 *   1. Google (sign-in identity — always connected if you can see
 *      this page)
 *   2. Chrome extension (YT Music sync — inferred from whether the
 *      user has ever synced tracks)
 *   3. Spotify (separate OAuth — checked via /api/spotify/status)
 *
 * Each row is a uniform shape: name + status chip + last-active
 * detail + an action link (manage permissions / install / connect /
 * disconnect / sync now). The board replaces the previous Google-
 * only ConnectionRow + the separate Service status row + the
 * separate Library summary "open library" link with a single
 * tighter layout.
 */
interface ConnectionsBoardProps {
  ko: boolean;
  googleEmail: string;
  extensionSyncedCount: number;
  extensionLastSyncedAt: string | null;
  spotifyFeatureEnabled: boolean;
}

interface SpotifyStatus {
  connected: boolean;
  lastSyncedAt: string | null;
  scope: string | null;
  featureEnabled?: boolean;
  enableEta?: string | null;
}

export function ConnectionsBoard({
  ko,
  googleEmail,
  extensionSyncedCount,
  extensionLastSyncedAt,
  spotifyFeatureEnabled,
}: ConnectionsBoardProps) {
  const router = useRouter();
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/status");
      if (!res.ok) return;
      setSpotify((await res.json()) as SpotifyStatus);
    } catch {
      /* keep null */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function disconnectSpotify() {
    if (
      !window.confirm(
        ko
          ? "Spotify 연결을 해제할까요? 가져온 곡은 그대로 남아있어요."
          : "Disconnect Spotify? Already-imported tracks stay in your library.",
      )
    )
      return;
    setDisconnecting(true);
    try {
      await fetch("/api/auth/spotify/disconnect", { method: "POST" });
      await refresh();
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  const extensionConnected = extensionSyncedCount > 0;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="flex flex-col gap-2">
      {/* Google — always connected */}
      <Row
        icon="🔑"
        name="Google"
        statusChip={
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
            {ko ? "로그인됨" : "Signed in"}
          </span>
        }
        detail={googleEmail}
        action={
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-neutral-400 hover:text-emerald-300 hover:underline"
          >
            {ko ? "권한 관리 ↗" : "Manage ↗"}
          </a>
        }
      />

      {/* Extension — inferred from synced_count */}
      <Row
        icon="🧩"
        name={ko ? "Chrome 익스텐션" : "Chrome extension"}
        statusChip={
          extensionConnected ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
              {extensionSyncedCount.toLocaleString()}{ko ? "곡 동기화됨" : " synced"}
            </span>
          ) : (
            <span className="rounded-full bg-neutral-700/40 px-2 py-0.5 text-[10px] text-neutral-400">
              {ko ? "미설치" : "Not installed"}
            </span>
          )
        }
        detail={
          extensionLastSyncedAt
            ? `${ko ? "마지막 sync " : "Last sync "}${fmtDate(extensionLastSyncedAt)}`
            : ko
              ? "익스텐션이 music.youtube.com에서 좋아요 곡 동기화"
              : "Extension auto-syncs Liked Songs from music.youtube.com"
        }
        action={
          extensionConnected ? (
            <Link
              href="/library"
              className="text-[11px] text-neutral-400 hover:text-emerald-300 hover:underline"
            >
              {ko ? "라이브러리 → " : "Library →"}
            </Link>
          ) : (
            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald-300 hover:text-emerald-200 hover:underline"
            >
              {ko ? "설치 ↗" : "Install ↗"}
            </a>
          )
        }
      />

      {/* Spotify — feature flag + connection state */}
      <Row
        icon="🟢"
        name="Spotify"
        statusChip={
          !spotifyFeatureEnabled ? (
            <span className="rounded-full bg-neutral-700/40 px-2 py-0.5 text-[10px] text-neutral-400">
              {ko ? "준비 중" : "Coming soon"}
            </span>
          ) : spotify?.connected ? (
            <span className="rounded-full bg-[#1DB954]/20 px-2 py-0.5 text-[10px] text-[#1DB954]">
              {ko ? "연결됨" : "Connected"}
            </span>
          ) : (
            <span className="rounded-full bg-neutral-700/40 px-2 py-0.5 text-[10px] text-neutral-400">
              {ko ? "미연결" : "Not connected"}
            </span>
          )
        }
        detail={
          !spotifyFeatureEnabled
            ? ko
              ? "Premium 가입 후 자동 활성화"
              : "Activates after Premium subscription"
            : spotify?.connected && spotify.lastSyncedAt
              ? `${ko ? "마지막 sync " : "Last sync "}${fmtDate(spotify.lastSyncedAt)}`
              : ko
                ? "Spotify 좋아요 + 자주 듣는 곡 + 플리"
                : "Liked Songs + top tracks + playlists"
        }
        action={
          !spotifyFeatureEnabled ? null : spotify?.connected ? (
            <button
              type="button"
              onClick={() => void disconnectSpotify()}
              disabled={disconnecting}
              className="text-[11px] text-rose-300 hover:text-rose-200 hover:underline disabled:opacity-50"
            >
              {disconnecting
                ? "…"
                : ko ? "연결 해제" : "Disconnect"}
            </button>
          ) : (
            <a
              href="/api/auth/spotify/start"
              className="text-[11px] text-[#1DB954] hover:text-[#1ed760] hover:underline"
            >
              {ko ? "연결" : "Connect"}
            </a>
          )
        }
      />
    </div>
  );
}

function Row({
  icon,
  name,
  statusChip,
  detail,
  action,
}: {
  icon: string;
  name: string;
  statusChip: React.ReactNode;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-lg">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-100">{name}</span>
          {statusChip}
        </div>
        <p className="text-[11px] text-neutral-500">{detail}</p>
      </div>
      {action && <div className="self-end sm:self-center">{action}</div>}
    </div>
  );
}
