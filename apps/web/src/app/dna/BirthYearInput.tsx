"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Birth-year field — needed to locate the 15–25 imprint window. */
export function BirthYearInput({ current }: { current: number | null }) {
  const router = useRouter();
  const [year, setYear] = useState(current ? String(current) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/birth-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(year) }),
      });
      if (res.ok) router.refresh();
      else setErr("연도를 다시 확인하세요 (예: 1996)");
    } catch {
      setErr("저장에 실패했습니다");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        placeholder="태어난 해 (예: 1996)"
        className="w-44 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none focus:border-emerald-500/60"
      />
      <button
        onClick={save}
        disabled={busy || !year}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
      >
        {current ? "수정" : "저장"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
