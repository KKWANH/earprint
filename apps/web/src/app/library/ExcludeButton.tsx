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
      className="shrink-0 rounded px-1.5 text-xs text-neutral-500 hover:text-white disabled:opacity-40"
      title={restore ? t.excludeIncludeTitle : t.excludeExcludeTitle}
    >
      {restore ? t.excludeRestore : t.excludeMark}
    </button>
  );
}
