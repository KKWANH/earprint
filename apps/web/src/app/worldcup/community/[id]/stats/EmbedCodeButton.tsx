"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * "Copy embed code" button for community-worldcup creators. Emits
 * `<iframe src=".../worldcup/community/<id>/embed">` to clipboard
 * so the user can paste their bracket into a blog post / Reddit
 * markdown / Tistory / Velog. Stats still post back to the same
 * /finish endpoint when the embedded version is played, so external
 * plays count toward the worldcup's stats.
 */
export function EmbedCodeButton({
  worldcupId,
  locale,
}: {
  worldcupId: string;
  locale: Locale;
}) {
  const [note, setNote] = useState<string | null>(null);
  async function copy() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://earprint.kwanho.dev";
    const html =
      `<iframe src="${origin}/worldcup/community/${worldcupId}/embed" ` +
      `width="640" height="780" frameborder="0" loading="lazy" ` +
      `title="Earprint worldcup" ` +
      `style="max-width:100%;border:0;border-radius:12px"></iframe>`;
    try {
      await navigator.clipboard.writeText(html);
      setNote(locale === "ko" ? "복사 완료" : "Copied");
    } catch {
      setNote(locale === "ko" ? "복사 실패" : "Copy failed");
    }
  }
  return (
    <button
      onClick={() => void copy()}
      className="mt-2 self-start rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300 hover:border-emerald-500/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
    >
      🪟 {note ?? (locale === "ko" ? "블로그/포럼용 임베드 코드 복사" : "Copy embed code for blogs/forums")}
    </button>
  );
}
