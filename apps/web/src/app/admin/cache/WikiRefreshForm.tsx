"use client";

import { useState } from "react";

/**
 * R34 — admin-side Wikipedia cache refresh form. Two modes:
 *   - Per-genre: type the genre name → POST /api/admin/wiki-refresh
 *     with the name → server clears + re-fetches → echo the new
 *     summary as proof.
 *   - Bulk clear: button → POST with genre='*' → clears the
 *     wiki_fetched_at for every row; subsequent /genre/[name]
 *     visits re-warm lazily.
 */
export function WikiRefreshForm() {
  const [genre, setGenre] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(target: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/wiki-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: target }),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        cleared?: number;
        summary?: { extractEn?: string | null; extractKo?: string | null };
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      if (typeof d.cleared === "number") {
        setResult(`✓ Cleared ${d.cleared} rows. Re-warm lazy on next visit.`);
      } else {
        const en = (d.summary?.extractEn ?? "").slice(0, 80);
        const ko = (d.summary?.extractKo ?? "").slice(0, 80);
        setResult(
          `✓ ${target}: en="${en}…" / ko="${ko}…"`,
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <h2 className="text-sm font-semibold text-white">
        Wikipedia cache — manual refresh
      </h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="genre name (lowercase)"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void refresh(genre.trim())}
          disabled={busy || !genre.trim()}
          className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-sky-400 disabled:opacity-40"
        >
          {busy ? "..." : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "This clears the Wikipedia cache for ALL genres. Lazy re-warm on visit. Continue?",
              )
            ) {
              void refresh("*");
            }
          }}
          disabled={busy}
          className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/60 disabled:opacity-40"
        >
          Bulk clear
        </button>
      </div>
      {result && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-200">
          {result}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}
