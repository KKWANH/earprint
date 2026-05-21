"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Foreground loop that backfills release years from Deezer, one batch at a
 * time, then refreshes the page so the reminiscence-bump chart appears.
 */
export function YearBackfill({ missing }: { missing: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [done, setDone] = useState(0);
  const [remaining, setRemaining] = useState(0);

  async function run() {
    setState("running");
    let total = 0;
    for (let i = 0; i < 600; i++) {
      try {
        const res = await fetch("/api/backfill-years", { method: "POST" });
        const d = (await res.json()) as { processed?: number; remaining?: number };
        total += d.processed ?? 0;
        setDone(total);
        setRemaining(d.remaining ?? 0);
        if (!d.processed || (d.remaining ?? 0) === 0) break;
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
        {done > 0
          ? `✅ 발매연도 ${done}곡을 새로 불러왔습니다.`
          : "✅ 발매연도가 모두 최신입니다 (Deezer 매칭된 곡은 모두 확인됨)."}
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
          ? `불러오는 중… ${done}곡 (남은 ${remaining})`
          : missing
            ? "발매연도 불러오기"
            : "발매연도 더 불러오기"}
      </button>
      <span className="text-xs text-neutral-500">
        Deezer 에서 곡별 발매연도를 가져옵니다 (1~2분, 창을 열어두세요).
      </span>
    </div>
  );
}
