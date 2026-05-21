"use client";

import { useState } from "react";

type State = "idle" | "busy" | "sent" | "skip" | "fail" | "nodata";

/** Re-sends the analysis-summary report email. */
export function ResendReportButton() {
  const [state, setState] = useState<State>("idle");

  async function go() {
    setState("busy");
    try {
      const res = await fetch("/api/resend-report", { method: "POST" });
      const d = (await res.json()) as { ok?: boolean; reason?: string };
      if (d.ok) setState("sent");
      else if (d.reason === "not_configured" || d.reason === "skipped") setState("skip");
      else if (d.reason === "no_data") setState("nodata");
      else setState("fail");
    } catch {
      setState("fail");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">분석 리포트 메일</h2>
        <p className="text-sm text-neutral-400">
          취향 요약(아티스트·장르·무드·오디오 특성)을 가입하신 메일로 보냅니다.
        </p>
        {state === "sent" && (
          <p className="mt-1 text-xs text-emerald-400">✅ 메일을 보냈습니다. 받은편지함을 확인하세요.</p>
        )}
        {state === "skip" && (
          <p className="mt-1 text-xs text-amber-400">
            ⚠ 메일 발송이 아직 설정되지 않았습니다 — Resend API 키가 필요합니다.
          </p>
        )}
        {state === "nodata" && (
          <p className="mt-1 text-xs text-neutral-500">동기화된 곡이 없어 보낼 내용이 없습니다.</p>
        )}
        {state === "fail" && (
          <p className="mt-1 text-xs text-red-400">❌ 발송에 실패했습니다. 잠시 후 다시 시도하세요.</p>
        )}
      </div>
      <button
        onClick={go}
        disabled={state === "busy"}
        className="shrink-0 rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
      >
        {state === "busy" ? "보내는 중…" : "메일 다시 보내기"}
      </button>
    </section>
  );
}
