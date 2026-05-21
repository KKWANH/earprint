"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EnrichResponse {
  processed: number;
  total: number;
  remaining: number;
}

/** "Run analysis" button — repeatedly calls /api/enrich until remaining reaches 0. */
export function EnrichPanel({ total, remaining }: { total: number; remaining: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [tot, setTot] = useState(total);
  const [done, setDone] = useState(total - remaining);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      for (let guard = 0; guard < 1000; guard++) {
        const res = await fetch("/api/enrich", { method: "POST" });
        if (!res.ok) {
          setError(`서버 오류 ${res.status}`);
          break;
        }
        const d = (await res.json()) as EnrichResponse;
        setTot(d.total);
        setDone(d.total - d.remaining);
        if (d.remaining === 0 || d.processed === 0) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
  const complete = done >= tot && tot > 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">트랙 분석</h2>
          <p className="text-sm text-neutral-400">
            Deezer 로 BPM · 장르 · 앨범 · 미리듣기를 보강합니다.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || complete}
          className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {running ? "분석 중…" : complete ? "분석 완료" : "분석 실행"}
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        {done.toLocaleString()} / {tot.toLocaleString()} 곡 분석됨 ({pct}%)
        {running && " — 진행 중, 페이지를 닫지 마세요"}
      </p>
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
