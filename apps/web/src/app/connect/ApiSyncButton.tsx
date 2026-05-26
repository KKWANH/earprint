"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { connectDict } from "@/lib/i18n/connect";

interface SyncResult {
  ok?: boolean;
  captured?: number;
  expected?: number;
  nextAfter?: string | null;
  error?: string;
  needsAuth?: boolean;
  note?: string;
}

/**
 * Mobile-friendly sync — calls /api/sync-yt which hits the YouTube Data API
 * with the user's OAuth token. When the user has never granted the YT scope,
 * the server returns `needsAuth` and we redirect to /api/yt-oauth/start.
 *
 * Also reads `#yt=...` from the URL hash so it can show a status message
 * after the OAuth callback redirects back here.
 */
export function ApiSyncButton({ locale }: { locale: Locale }) {
  const t = connectDict(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    kind: "success" | "error" | "info";
  } | null>(null);

  // React to the OAuth callback's `#yt=...` hash so users get feedback right
  // after they grant the YouTube scope.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.match(/^#yt=([\w-]+)/);
    if (!hash) return;
    const status = hash[1]!;
    if (status === "connected") {
      setMsg({ text: t.apiYtConnected, kind: "success" });
    } else if (status === "cancelled") {
      setMsg({ text: t.apiYtCancelled, kind: "info" });
    } else {
      setMsg({
        text: `${t.apiSyncFailed} (${status})`,
        kind: "error",
      });
    }
    // Strip the hash so a refresh doesn't re-show the toast.
    history.replaceState(null, "", window.location.pathname);
  }, [t]);

  async function run() {
    setBusy(true);
    setMsg(null);
    // Server chunks at 5 pages (250 tracks) per call to fit inside the
    // Cloudflare Workers 50-subrequest cap; we loop until nextAfter is
    // null. Total captured count accumulates across chunks.
    let totalCaptured = 0;
    let expected = 0;
    let after: string | undefined;
    const MAX_CHUNKS = 50; // 50 × 250 = 12,500 tracks ceiling, plenty for any real library
    try {
      for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
        const res = await fetch("/api/sync-yt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(after ? { after } : {}),
        });
        const data = (await res.json()) as SyncResult;
        if (!res.ok || !data.ok) {
          if (data.needsAuth) {
            window.location.href = "/api/yt-oauth/start";
            return;
          }
          setMsg({
            text: `${t.apiSyncFailed}: ${data.error ?? res.statusText}`,
            kind: "error",
          });
          return;
        }
        totalCaptured += data.captured ?? 0;
        expected = data.expected ?? expected;
        // Live progress while looping.
        setMsg({
          text: t.apiSyncSuccess(totalCaptured, expected),
          kind: "info",
        });
        if (!data.nextAfter) break; // done
        after = data.nextAfter;
      }
      if (totalCaptured === 0) {
        setMsg({ text: t.apiSyncEmpty, kind: "info" });
      } else {
        setMsg({
          text: t.apiSyncSuccess(totalCaptured, expected),
          kind: "success",
        });
      }
      router.refresh();
    } catch (e) {
      setMsg({
        text: `${t.apiSyncFailed}: ${String(e)}`,
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t.apiSyncRunning : t.apiSyncButton}
      </button>
      {msg && (
        <p
          className={`text-xs leading-relaxed ${
            msg.kind === "success"
              ? "text-emerald-300"
              : msg.kind === "error"
                ? "text-rose-300"
                : "text-neutral-400"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
