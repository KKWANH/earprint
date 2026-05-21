"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MODES = [
  { id: "mix", emoji: "🎲", label: "골고루", hint: "여러 방식을 섞어서" },
  { id: "song", emoji: "❤️", label: "곡 기반", hint: "좋아한 곡과 비슷한 곡" },
  { id: "genre", emoji: "🎼", label: "장르 기반", hint: "내 핵심 장르의 명곡" },
  { id: "unheard", emoji: "🧭", label: "안 들어본 장르", hint: "취향 밖 새 장르" },
  { id: "indie", emoji: "💎", label: "숨은 인디", hint: "덜 알려진 영세 아티스트" },
];

/** Picks a recommendation flavour and generates a fresh batch. */
export function ModePicker() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function generate(mode: string) {
    setBusy(mode);
    try {
      await fetch("/api/recommend/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      router.refresh();
    } catch {
      /* ignore */
    }
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-medium">추천 방식 고르기</p>
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => generate(m.id)}
            disabled={busy != null}
            title={m.hint}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm transition-colors hover:border-emerald-500/50 hover:bg-white/10 disabled:opacity-40"
          >
            {busy === m.id ? "만드는 중… (~10초)" : `${m.emoji} ${m.label}`}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">
        고른 방식으로 새 추천 묶음이 만들어집니다. 평가한 곡(좋아요·이미 앎)은
        라이브러리에 반영됩니다.
      </p>
    </section>
  );
}
