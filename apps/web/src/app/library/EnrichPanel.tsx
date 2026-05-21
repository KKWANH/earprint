"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Res {
  processed: number;
  total: number;
  remaining: number;
}

const BATCH = 8;
const ROUGH_SECONDS_PER_TRACK = 0.8; // pre-run estimate before timing data exists

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}초`;
  return `약 ${Math.ceil(seconds / 60)}분`;
}

/** "Run analysis" button — repeatedly calls /api/enrich until remaining reaches 0. */
export function EnrichPanel({
  total,
  remaining: initialRemaining,
}: {
  total: number;
  remaining: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [eta, setEta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const startedAt = Date.now();
    let processedTotal = 0;
    try {
      let prev = -1;
      for (let guard = 0; guard < 1000; guard++) {
        const res = await fetch("/api/enrich", { method: "POST" });
        if (!res.ok) {
          setError(`서버 오류 ${res.status}`);
          break;
        }
        const d = (await res.json()) as Res;
        setRemaining(d.remaining);
        processedTotal += d.processed;
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

  const done = total - remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = remaining === 0 && total > 0;
  const roughEta = formatDuration(remaining * ROUGH_SECONDS_PER_TRACK);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">트랙 분석</h2>
          <p className="text-sm text-neutral-400">
            Deezer · Last.fm 으로 장르 · 무드 · 앨범 · 미리듣기를 보강합니다.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || complete}
          className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {running ? "분석 중…" : complete ? "분석 완료" : done > 0 ? "이어서 실행" : "분석 실행"}
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>
          {done.toLocaleString()} / {total.toLocaleString()}곡 ({pct}%)
        </span>
        {!complete && (
          <span>남은 배치 {Math.ceil(remaining / BATCH).toLocaleString()}개</span>
        )}
        {running && eta && <span className="text-emerald-300">예상 {eta} 남음</span>}
        {running && !eta && <span className="text-emerald-300">예상 {roughEta} 소요</span>}
        {!running && !complete && <span>예상 소요 {roughEta}</span>}
      </div>

      {!complete && (
        <p className="text-xs text-neutral-500">
          💾 창을 닫아도 분석된 곡은 저장됩니다. 나중에 돌아와 &ldquo;이어서 실행&rdquo;을
          누르면 멈춘 지점부터 계속됩니다.
        </p>
      )}
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
