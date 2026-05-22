"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { artistDict } from "@/lib/i18n/artist";

/**
 * In-library: a 3-step affinity rating (normal / like / favorite).
 * Discovery: three "add to library" buttons that also seed the affinity.
 */
export function ArtistActions({
  name,
  inLibrary,
  affinity,
  locale,
}: {
  name: string;
  inLibrary: boolean;
  affinity: number;
  locale: Locale;
}) {
  const t = artistDict(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [weight, setWeight] = useState(affinity);
  const [done, setDone] = useState<"saved" | "added" | "failed" | null>(null);

  async function rate(w: number) {
    if (busy) return;
    setBusy(true);
    setWeight(w);
    try {
      const res = await fetch("/api/affinity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: name, weight: w }),
      });
      setDone(res.ok ? "saved" : "failed");
      if (res.ok) router.refresh();
    } catch {
      setDone("failed");
    }
    setBusy(false);
  }

  async function add(w: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/discover-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: name, weight: w }),
      });
      const d = (await res.json()) as { ok?: boolean };
      if (res.ok && d.ok) {
        setDone("added");
        router.refresh();
      } else {
        setDone("failed");
      }
    } catch {
      setDone("failed");
    }
    setBusy(false);
  }

  if (inLibrary) {
    const labels = [t.affinityNormal, t.affinityLike, t.affinityFavorite];
    const level = Math.min(3, Math.max(1, Math.round(weight)));
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-neutral-400">{t.affinityPrompt}</p>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => rate(n)}
                disabled={busy}
                aria-label={labels[n - 1]}
                className={`text-2xl leading-none transition-transform hover:scale-110 disabled:opacity-40 ${
                  n <= level ? "text-amber-400" : "text-neutral-600 hover:text-amber-400/50"
                }`}
              >
                {n <= level ? "★" : "☆"}
              </button>
            ))}
          </div>
          <span className="text-sm font-semibold text-amber-200">{labels[level - 1]}</span>
          {done === "saved" && (
            <span className="text-xs text-emerald-400">✓ {t.affinitySaved}</span>
          )}
          {done === "failed" && <span className="text-xs text-rose-400">{t.addFailed}</span>}
        </div>
      </div>
    );
  }

  if (done === "added") {
    return <p className="text-sm font-medium text-emerald-400">{t.added}</p>;
  }

  const addOpts = [
    { w: 1, label: t.addNormal },
    { w: 2, label: t.addLike },
    { w: 3, label: t.addFavorite },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-500">{t.notInLibraryHint}</p>
      <div className="flex flex-wrap gap-1.5">
        {addOpts.map((o) => (
          <button
            key={o.w}
            onClick={() => add(o.w)}
            disabled={busy}
            className="rounded-md bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
          >
            {o.label}
          </button>
        ))}
      </div>
      {busy && <p className="text-[11px] text-neutral-500">{t.adding}</p>}
      {done === "failed" && <p className="text-[11px] text-rose-400">{t.addFailed}</p>}
    </div>
  );
}
