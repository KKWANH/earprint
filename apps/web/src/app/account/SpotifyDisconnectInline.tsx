"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountDict } from "@/lib/i18n/account";

/**
 * R32d — small connection status chip + disconnect button rendered
 * inside /account's Service status row. Visible only when the user
 * has an active Spotify connection. Mirrors the SpotifyConnectCard
 * disconnect path (POST /api/auth/spotify/disconnect → router.refresh).
 *
 * The status is fetched on mount via /api/spotify/status to avoid
 * a server-side join from the account page itself. Cheap one-row
 * lookup; degrades to "no chip" on failure.
 */
export function SpotifyDisconnectInline({ ko }: { ko: boolean }) {
  const router = useRouter();
  const t = accountDict(ko ? "ko" : "en");
  const [state, setState] = useState<
    "loading" | "not-connected" | "connected" | "disconnecting"
  >("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/status");
      if (!res.ok) {
        setState("not-connected");
        return;
      }
      const d = (await res.json()) as {
        connected?: boolean;
        lastSyncedAt?: string | null;
      };
      setLastSyncedAt(d.lastSyncedAt ?? null);
      setState(d.connected ? "connected" : "not-connected");
    } catch {
      setState("not-connected");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (state === "loading" || state === "not-connected") return null;

  async function disconnect() {
    if (state === "disconnecting") return;
    if (!window.confirm(t.spotifyDisconnectConfirm)) return;
    setState("disconnecting");
    try {
      const res = await fetch("/api/auth/spotify/disconnect", { method: "POST" });
      if (res.ok) {
        setState("not-connected");
        router.refresh();
      } else {
        setState("connected");
      }
    } catch {
      setState("connected");
    }
  }

  return (
    <>
      <span className="text-neutral-700">·</span>
      <span className="text-neutral-400">
        {t.spotifyMine}
      </span>
      <span className="rounded-full bg-[#1DB954]/20 px-2 py-0.5 text-[#1DB954]">
        {t.connBoardSpotifyConnected}
      </span>
      {lastSyncedAt && (
        <span className="text-[10px] text-neutral-500">
          {new Date(lastSyncedAt).toLocaleDateString(ko ? "ko-KR" : "en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
      <button
        type="button"
        onClick={() => void disconnect()}
        disabled={state === "disconnecting"}
        className="rounded-md border border-rose-500/40 px-2 py-0.5 text-[11px] text-rose-200 hover:bg-rose-950/30 disabled:opacity-50"
      >
        {state === "disconnecting" ? "…" : t.spotifyDisconnect}
      </button>
    </>
  );
}
