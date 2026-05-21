"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Res {
  ok: boolean;
  processed: number;
  remaining: number;
  error?: string;
}

const BATCH = 8;
const ROUGH_SECONDS_PER_TRACK = 1.6; // pre-run estimate before timing data exists

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}초`;
  return `약 ${Math.ceil(seconds / 60)}분`;
}

/** Enriches tracks the API could not fill via Gemini — repeatedly calls /api/enrich-ai. */
export function AiEnrichPanel({ missing }: { missing: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(missing);
  const [eta, setEta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const startedAt = Date.now();
    let processedTotal = 0;
    try {
      let prev = -1;
      for (let guard = 0; guard < 400; guard++) {
        const res = await fetch("/api/enrich-ai", { method: "POST" });
        const d = (await res.json()) as Res;
        if (!res.ok || !d.ok) {
          setError(d.error ?? `서버 오류 ${res.status}`);
          break;
        }
        setRemaining(d.remaining);
        processedTotal += d.processed;
        // Live estimate from the average time per track so far.
        if (processedTotal > 0) {
          const perTrack = (Date.now() - startedAt) / processedTotal / 1000;
          setEta(formatDuration(d.remaining * perTrack));
        }
        if (d.remaining === 0 || d.processed === 0 || d.remaining === prev) break;
        prev = d.remaining;
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
      setEta(null);
      router.refresh();
    }
  }

  const done = missing - remaining;
  const pct = missing > 0 ? Math.round((done / missing) * 100) : 100;
  const complete = remaining === 0;
  const roughEta = formatDuration(remaining * ROUGH_SECONDS_PER_TRACK);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-indigo-900/60 bg-neutral-900 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">AI 보강 — 장르 빈 곡 {missing.toLocaleString()}곡</h2>
          <p className="text-sm text-neutral-400">
            Last.fm 이 못 채운 곡을 Gemini 가 추론하고, 뮤비·모음 채널은 원곡 아티스트로 재매핑합니다.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || complete}
          className="shrink-0 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {running ? "보강 중…" : complete ? "보강 완료" : done > 0 ? "이어서 실행" : "AI 보강 실행"}
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>
          {done.toLocaleString()} / {missing.toLocaleString()}곡 ({pct}%)
        </span>
        {!complete && (
          <span>남은 배치 {Math.ceil(remaining / BATCH).toLocaleString()}개</span>
        )}
        {running && eta && <span className="text-indigo-300">예상 {eta} 남음</span>}
        {running && !eta && <span className="text-indigo-300">예상 {roughEta} 소요</span>}
        {!running && !complete && <span>예상 소요 {roughEta}</span>}
      </div>

      {!complete && (
        <p className="text-xs text-neutral-500">
          💾 창을 닫아도 보강된 곡은 저장됩니다. 나중에 이 페이지로 돌아와 &ldquo;이어서
          실행&rdquo;을 누르면 멈춘 지점부터 계속됩니다.
        </p>
      )}
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
