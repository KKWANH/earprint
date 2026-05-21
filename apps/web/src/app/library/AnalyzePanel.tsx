"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
export function AnalyzePanel() {
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
      ? "1/2 · 메타데이터 보강 (Deezer)"
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
            Deezer 로 보강한 뒤 Gemini 가 장르 · 무드 · 오디오 특성을 정밀 분석합니다.
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
          ⚙ 이 창을 열어두면 빠르게 진행됩니다. 닫아도 백그라운드에서 계속돼요.
          분석이 끝나면 메일로 알려드립니다. 📬
        </p>
      )}
      {complete && (
        <p className="text-xs text-neutral-500">
          📬 분석 요약을 가입하신 메일로 보내드렸어요.
        </p>
      )}
      {job.enrich.total === 0 && (
        <p className="text-xs text-neutral-600">동기화된 곡이 없습니다.</p>
      )}
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
