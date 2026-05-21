"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { dnaDict } from "@/lib/i18n/dna";

/** Birth-year field — needed to locate the 15–25 imprint window. */
export function BirthYearInput({
  current,
  locale,
}: {
  current: number | null;
  locale: Locale;
}) {
  const t = dnaDict(locale);
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
      else setErr(t.birthYearError);
    } catch {
      setErr(t.birthYearSaveError);
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
        placeholder={t.birthYearPlaceholder}
        className="w-44 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none focus:border-emerald-500/60"
      />
      <button
        onClick={save}
        disabled={busy || !year}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
      >
        {current ? t.birthYearEdit : t.birthYearSave}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
