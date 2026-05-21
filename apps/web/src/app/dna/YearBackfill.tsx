"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dnaDict } from "@/lib/i18n/dna";

/**
 * Foreground loop that backfills release years from Deezer, one batch at a
 * time, then refreshes the page so the reminiscence-bump chart appears.
 */
export function YearBackfill({
  missing,
  locale,
}: {
  missing: boolean;
  locale: Locale;
}) {
  const t = dnaDict(locale);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [done, setDone] = useState(0);
  const [remaining, setRemaining] = useState(0);

  async function run() {
    setState("running");
    let total = 0;
    let lastRemaining = -1;
    let stall = 0;
    for (let i = 0; i < 800; i++) {
      try {
        const res = await fetch("/api/backfill-years", { method: "POST" });
        const d = (await res.json()) as { processed?: number; remaining?: number };
        total += d.processed ?? 0;
        const rem = d.remaining ?? 0;
        setDone(total);
        setRemaining(rem);
        if (!d.processed || rem === 0) break;
        // remaining not shrinking ⇒ Deezer is throttling — give up gracefully
        stall = rem === lastRemaining ? stall + 1 : 0;
        if (stall >= 6) break;
        lastRemaining = rem;
        await new Promise((r) => setTimeout(r, 700)); // spaced — avoid Deezer rate limit
      } catch {
        break;
      }
    }
    setState("done");
    router.refresh();
  }

  if (state === "done") {
    return (
      <p className="text-xs text-emerald-400">
        {done > 0 ? t.backfillDoneSome(done) : t.backfillDoneNone}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={run}
        disabled={state === "running"}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {state === "running"
          ? t.backfillRunning(done, remaining)
          : missing
            ? t.backfillStart
            : t.backfillMore}
      </button>
      <span className="text-xs text-neutral-500">{t.backfillHelp}</span>
    </div>
  );
}
