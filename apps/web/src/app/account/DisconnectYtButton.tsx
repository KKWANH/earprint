"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { accountDict } from "@/lib/i18n/account";

/** Revokes the user's YouTube grant and clears stored tokens. */
export function DisconnectYtButton({ locale }: { locale: Locale }) {
  const t = accountDict(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/yt-oauth/disconnect", { method: "POST" });
      if (!res.ok) {
        setMsg(t.disconnectFailed);
        return;
      }
      setMsg(t.disconnectSuccess);
      router.refresh();
    } catch {
      setMsg(t.disconnectFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? t.disconnecting : t.disconnectYtButton}
      </button>
      {msg && <p className="text-xs text-neutral-400">{msg}</p>}
    </div>
  );
}
