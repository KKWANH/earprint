"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { libraryDict } from "@/lib/i18n/library";

type State = "idle" | "busy" | "sent" | "skip" | "fail" | "nodata";

/** Re-sends the analysis-summary report email. */
export function ResendReportButton({ locale }: { locale: Locale }) {
  const t = libraryDict(locale);
  const [state, setState] = useState<State>("idle");

  async function go() {
    setState("busy");
    try {
      const res = await fetch("/api/resend-report", { method: "POST" });
      const d = (await res.json()) as { ok?: boolean; reason?: string };
      if (d.ok) setState("sent");
      else if (d.reason === "not_configured" || d.reason === "skipped") setState("skip");
      else if (d.reason === "no_data") setState("nodata");
      else setState("fail");
    } catch {
      setState("fail");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">{t.reportTitle}</h2>
        <p className="text-sm text-neutral-400">
          {t.reportDesc}
        </p>
        {state === "sent" && (
          <p className="mt-1 text-xs text-emerald-400">{t.reportSent}</p>
        )}
        {state === "skip" && (
          <p className="mt-1 text-xs text-amber-400">
            {t.reportSkip}
          </p>
        )}
        {state === "nodata" && (
          <p className="mt-1 text-xs text-neutral-500">{t.reportNoData}</p>
        )}
        {state === "fail" && (
          <p className="mt-1 text-xs text-red-400">{t.reportFail}</p>
        )}
      </div>
      <button
        onClick={go}
        disabled={state === "busy"}
        className="shrink-0 rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
      >
        {state === "busy" ? t.reportSending : t.reportResend}
      </button>
    </section>
  );
}
