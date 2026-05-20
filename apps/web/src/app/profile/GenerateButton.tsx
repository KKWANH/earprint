"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Gemini 심리분석 생성/재생성 버튼. */
export function GenerateButton({ hasProfile }: { hasProfile: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { method: "POST" });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!d.ok) setError(d.error ?? `오류 ${res.status}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={go}
        disabled={busy}
        className="self-start rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
      >
        {busy ? "Gemini 분석 중… (~10초)" : hasProfile ? "다시 분석하기" : "AI 분석 생성"}
      </button>
      {error && <p className="text-xs text-red-400">오류: {error}</p>}
    </div>
  );
}
