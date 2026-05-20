"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Res {
  ok: boolean;
  processed: number;
  remaining: number;
  error?: string;
}

/** API 가 못 채운 곡을 Gemini 로 보강 — /api/enrich-ai 를 반복 호출. */
export function AiEnrichPanel({ missing }: { missing: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(missing);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
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
        if (d.remaining === 0 || d.processed === 0 || d.remaining === prev) break;
        prev = d.remaining;
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const done = missing - remaining;
  const pct = missing > 0 ? Math.round((done / missing) * 100) : 100;

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
          disabled={running || remaining === 0}
          className="shrink-0 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {running ? "보강 중…" : remaining === 0 ? "보강 완료" : "AI 보강 실행"}
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-500">
        {done.toLocaleString()} / {missing.toLocaleString()} 곡 보강됨 ({pct}%)
        {running && " — 진행 중"}
      </p>
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </section>
  );
}
