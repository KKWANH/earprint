"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { libraryDict } from "@/lib/i18n/library";

interface JobsResponse {
  status: string;
  phase: "enrich" | "ai" | "done";
  enrich: { total: number; remaining: number };
  ai: { total: number; remaining: number };
}

/**
 * Single start/stop control for the analysis pipeline (enrich → AI analysis).
 * While the panel is open it drives batches in the foreground (fast); the
 * cron keeps the job going after the tab closes.
 */
export function AnalyzePanel({ locale }: { locale: Locale }) {
  const t = libraryDict(locale);
  const [job, setJob] = useState<JobsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const looping = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) setJob((await res.json()) as JobsResponse);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Foreground accelerator — drive batches as fast as they finish while the
  // panel is open. Each tick processes one batch and returns fresh progress.
  useEffect(() => {
    if (job?.status !== "running" || looping.current) return;
    looping.current = true;
    let cancelled = false;
    void (async () => {
      while (!cancelled) {
        try {
          const res = await fetch("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "tick" }),
          });
          if (!res.ok) break;
          const d = (await res.json()) as JobsResponse;
          if (cancelled) break;
          setJob(d);
          if (d.status !== "running") break;
          if (d.enrich.remaining === 0 && d.ai.remaining === 0) break;
        } catch {
          break;
        }
      }
      looping.current = false;
    })();
    return () => {
      cancelled = true;
      looping.current = false;
    };
  }, [job?.status]);

  async function act(action: "start" | "stop") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? t.errorCode(res.status));
      }
    } catch (e) {
      setError(String(e));
    }
    setBusy(false);
    await refresh();
  }

  if (!job) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-500">
        {t.analyzeLoading}
      </section>
    );
  }

  const running = job.status === "running";
  const complete = job.enrich.total > 0 && job.phase === "done";
  const cur = job.phase === "ai" ? job.ai : job.enrich;
  const done = cur.total - cur.remaining;
  const pct = cur.total > 0 ? Math.round((done / cur.total) * 100) : 0;
  const phaseLabel =
    job.phase === "enrich"
      ? t.phaseEnrich
      : job.phase === "ai"
        ? t.phaseAi
        : t.phaseDone;
  const started = job.enrich.remaining < job.enrich.total || job.ai.total > 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{t.analyzeTitle}</h2>
          <p className="text-sm text-neutral-400">
            {t.analyzeDesc}
          </p>
        </div>
        {complete ? (
          <span className="shrink-0 rounded-md bg-white/10 px-3 py-2 text-sm">{t.analyzeComplete}</span>
        ) : running ? (
          <button
            onClick={() => act("stop")}
            disabled={busy}
            className="shrink-0 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t.analyzeStop}
          </button>
        ) : (
          <button
            onClick={() => act("start")}
            disabled={busy || job.enrich.total === 0}
            className="shrink-0 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {started ? t.analyzeResume : t.analyzeStart}
          </button>
        )}
      </div>

      {!complete && (
        <>
          <p className="text-xs text-emerald-300">{phaseLabel}</p>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500">
            {t.progressTracks(done.toLocaleString(), cur.total.toLocaleString(), pct)}
          </p>
        </>
      )}

      {running && (
        <p className="text-xs text-neutral-500">
          {t.runningHint}
        </p>
      )}
      {complete && (
        <p className="text-xs text-neutral-500">
          {t.completeHint}
        </p>
      )}
      {job.enrich.total === 0 && (
        <p className="text-xs text-neutral-600">{t.noSyncedTracks}</p>
      )}
      {error && <p className="text-xs text-red-400">{t.errorPrefix} {error}</p>}
    </section>
  );
}
