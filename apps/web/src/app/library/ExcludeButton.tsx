"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { libraryDict } from "@/lib/i18n/library";

/** Excludes an artist from analysis (✕) or restores it. */
export function ExcludeButton({
  artist,
  restore,
  locale,
}: {
  artist: string;
  restore?: boolean;
  locale: Locale;
}) {
  const t = libraryDict(locale);
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
      // Small soft chip (not the old bare ✕ that read as "delete"). The
      // bordered hover state makes the action feel reversible — which
      // it literally is.
      className="shrink-0 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] text-neutral-500 hover:border-white/15 hover:bg-white/5 hover:text-neutral-200 disabled:opacity-40"
      title={restore ? t.excludeIncludeTitle : t.excludeExcludeTitle}
    >
      {restore ? t.excludeRestore : t.excludeMark}
    </button>
  );
}
