"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface KindState {
  status: string;
  total: number;
  remaining: number;
}
interface JobsResponse {
  enrich: KindState;
  aiEnrich: KindState;
  audioFeel: KindState;
}

/**
 * Start/stop control + live progress for a background enrichment job.
 * The job runs server-side (cron-driven), so it continues after the tab closes;
 * this panel just observes and polls while open.
 */
export function JobPanel({
  kind,
  title,
  description,
  accent,
}: {
  kind: "enrich" | "ai_enrich" | "audio_feel";
  title: string;
  description: string;
  accent: string;
}) {
  const field: keyof JobsResponse =
    kind === "enrich" ? "enrich" : kind === "ai_enrich" ? "aiEnrich" : "audioFeel";
  const [state, setState] = useState<KindState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const d = (await res.json()) as JobsResponse;
      setState(d[field]);
    } catch {
      /* ignore */
    }
  }, [field]);

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    const running = state?.status === "running";
    if (running && !pollRef.current) {
      pollRef.current = setInterval(() => void refresh(), 5000);
    } else if (!running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [state?.status, refresh]);

  async function act(action: "start" | "stop") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, action }),
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

  if (!state) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-500">
        {title} — 불러오는 중…
      </section>
    );
  }

  const { status, total, remaining } = state;
  const done = total - remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const running = status === "running";
  const complete = total > 0 && remaining === 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-neutral-400">{description}</p>
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
            disabled={busy || total === 0}
            className={`shrink-0 rounded-md ${accent} px-4 py-2 text-sm font-medium text-white disabled:opacity-40`}
          >
            {done > 0 ? "이어서 시작" : "시작"}
          </button>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${accent} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-500">
        {done.toLocaleString()} / {total.toLocaleString()}곡 ({pct}%)
        {remaining > 0 && ` · 남은 ${remaining.toLocaleString()}곡`}
      </p>

      {running && (
        <p className="text-xs text-emerald-400">
          ⚙ 백그라운드에서 진행 중 — 창을 닫아도 계속됩니다 (분당 약 8곡 처리).
        </p>
      )}
      {total === 0 && (
        <p className="text-xs text-neutral-600">
          {kind === "enrich" ? "동기화된 곡이 없습니다." : "먼저 트랙 분석을 실행하세요."}
        </p>
      )}
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
