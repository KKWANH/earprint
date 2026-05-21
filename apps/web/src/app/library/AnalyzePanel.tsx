"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface JobsResponse {
  status: string;
  phase: "enrich" | "ai" | "done";
  enrich: { total: number; remaining: number };
  ai: { total: number; remaining: number };
}

/**
 * Single start/stop control for the whole analysis pipeline
 * (phase 1: Deezer/Last.fm enrichment → phase 2: Gemini AI analysis).
 * Runs server-side (cron-driven) so it continues after the tab closes.
 */
export function AnalyzePanel() {
  const [job, setJob] = useState<JobsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    const running = job?.status === "running";
    if (running && !pollRef.current) {
      pollRef.current = setInterval(() => void refresh(), 5000);
    } else if (!running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [job?.status, refresh]);

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
        setError(d.error ?? `오류 ${res.status}`);
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
        곡 분석 — 불러오는 중…
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
      ? "1/2 · 장르 · 앨범 보강"
      : job.phase === "ai"
        ? "2/2 · AI 정밀 분석 (장르 · 무드 · 오디오 특성)"
        : "완료";
  const started = job.enrich.remaining < job.enrich.total || job.ai.total > 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">곡 분석</h2>
          <p className="text-sm text-neutral-400">
            Deezer · Last.fm 으로 보강한 뒤 Gemini 가 장르 · 무드 · 오디오 특성을 정밀 분석합니다.
          </p>
        </div>
        {complete ? (
          <span className="shrink-0 rounded-md bg-white/10 px-3 py-2 text-sm">완료</span>
        ) : running ? (
          <button
            onClick={() => act("stop")}
            disabled={busy}
            className="shrink-0 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            정지
          </button>
        ) : (
          <button
            onClick={() => act("start")}
            disabled={busy || job.enrich.total === 0}
            className="shrink-0 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {started ? "이어서 시작" : "분석 시작"}
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
            {done.toLocaleString()} / {cur.total.toLocaleString()}곡 ({pct}%)
          </p>
        </>
      )}

      {running && (
        <p className="text-xs text-neutral-500">
          ⚙ 백그라운드에서 진행 중 — 창을 닫아도 계속됩니다 (분당 약 8곡).
        </p>
      )}
      {job.enrich.total === 0 && (
        <p className="text-xs text-neutral-600">동기화된 곡이 없습니다.</p>
      )}
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
