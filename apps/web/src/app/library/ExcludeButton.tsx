"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Excludes an artist from analysis (✕) or restores it. */
export function ExcludeButton({ artist, restore }: { artist: string; restore?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    await fetch("/api/exclude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist, action: restore ? "restore" : "exclude" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className="shrink-0 rounded px-1.5 text-xs text-neutral-500 hover:text-white disabled:opacity-40"
      title={restore ? "분석에 다시 포함" : "분석에서 제외"}
    >
      {restore ? "복원" : "✕"}
    </button>
  );
}
