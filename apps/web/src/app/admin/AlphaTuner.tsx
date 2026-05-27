"use client";

import { useEffect, useRef, useState } from "react";

interface PreviewRow {
  name: string;
  count: number;
  score: number;
}

/**
 * Slider + live preview for `app_settings.recency_alpha`.
 *
 * The slider drives a debounced GET to `/api/admin/settings?alpha=X` that
 * returns the admin's own top-5 artists computed with that α — no save,
 * just a preview. "Apply" POSTs the value and the next page-render sees
 * it (so reload the library to validate downstream effects).
 *
 * Debounce keeps us from hammering the DB on every pixel of drag; 250 ms
 * feels responsive enough for tuning without spamming.
 */
export function AlphaTuner({ initial }: { initial: number }) {
  const [alpha, setAlpha] = useState(initial);
  const [savedAlpha, setSavedAlpha] = useState(initial);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial preview at the saved α (no debounce needed — runs once).
  useEffect(() => {
    void fetchPreview(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPreview(a: number) {
    try {
      const res = await fetch(`/api/admin/settings?alpha=${a.toFixed(2)}`);
      if (!res.ok) return;
      const d = (await res.json()) as { preview?: PreviewRow[] };
      if (d.preview) setPreview(d.preview);
    } catch {
      /* swallow — preview is best-effort */
    }
  }

  function onSlide(v: number) {
    setAlpha(v);
    setNote(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(v), 250);
  }

  async function apply() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alpha }),
      });
      if (res.ok) {
        setSavedAlpha(alpha);
        setNote(`Saved α = ${alpha.toFixed(2)}. Library queries pick it up immediately.`);
      } else {
        setNote(`Save failed: HTTP ${res.status}`);
      }
    } catch (e) {
      setNote(`Save failed: ${String(e)}`);
    }
    setBusy(false);
  }

  const dirty = Math.abs(alpha - savedAlpha) > 0.005;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={alpha}
          onChange={(e) => onSlide(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
        />
        <span className="w-16 text-right font-mono text-sm tabular-nums">
          {alpha.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-500">
          Saved: <span className="font-mono">{savedAlpha.toFixed(2)}</span>
        </span>
        <button
          onClick={apply}
          disabled={busy || !dirty}
          className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-black disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {busy ? "Saving…" : dirty ? "Apply" : "No change"}
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Preview · your top 5 at α = {alpha.toFixed(2)}
        </p>
        {preview == null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : preview.length === 0 ? (
          <p className="text-sm text-neutral-500">No data.</p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {preview.map((p, i) => (
              <li
                key={p.name}
                className="flex items-center justify-between gap-3 text-neutral-200"
              >
                <span>
                  <span className="mr-2 inline-block w-5 text-right text-neutral-500">
                    {i + 1}.
                  </span>
                  {p.name}
                </span>
                <span className="text-xs text-neutral-500">
                  {p.count} tracks · score {p.score.toFixed(1)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {note && <p className="text-xs text-emerald-300">{note}</p>}
    </div>
  );
}
