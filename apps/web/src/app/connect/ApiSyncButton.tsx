"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { connectDict } from "@/lib/i18n/connect";

interface SyncResult {
  ok?: boolean;
  captured?: number;
  expected?: number;
  error?: string;
  note?: string;
}

/**
 * Mobile-friendly sync — calls /api/sync-yt which hits the YouTube Data API
 * with the user's OAuth token. Falls back from the extension flow.
 */
export function ApiSyncButton({ locale }: { locale: Locale }) {
  const t = connectDict(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    kind: "success" | "error" | "info";
  } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync-yt", { method: "POST" });
      const data = (await res.json()) as SyncResult;
      if (!res.ok || !data.ok) {
        if (res.status === 401 || res.status === 403) {
          setMsg({ text: t.apiSyncNeedScope, kind: "error" });
        } else {
          setMsg({
            text: `${t.apiSyncFailed}: ${data.error ?? res.statusText}`,
            kind: "error",
          });
        }
        return;
      }
      const captured = data.captured ?? 0;
      const expected = data.expected ?? captured;
      setMsg({
        text: data.note ?? t.apiSyncSuccess(captured, expected),
        kind: captured > 0 ? "success" : "info",
      });
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
