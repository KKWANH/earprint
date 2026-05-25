"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { profileDict } from "@/lib/i18n/profile";

/** Button to generate/regenerate the Gemini psychological analysis. */
export function GenerateButton({
  hasProfile,
  locale,
}: {
  hasProfile: boolean;
  locale: Locale;
}) {
  const t = profileDict(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [planCapped, setPlanCapped] = useState(false);

  async function go() {
    setBusy(true);
    setError(null);
    setCapped(false);
    setPlanCapped(false);
    try {
      const res = await fetch("/api/profile", { method: "POST" });
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        capped?: boolean;
        planCapped?: boolean;
      };
      if (d.planCapped) setPlanCapped(true);
      else if (d.capped) setCapped(true);
      else if (!d.ok) setError(d.error ?? `${t.errorStatus} ${res.status}`);
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
        {busy ? t.generating : hasProfile ? t.reanalyze : t.generate}
      </button>
      {capped && <p className="text-xs text-amber-400">{t.capped}</p>}
      {planCapped && (
        <p className="text-xs leading-relaxed text-amber-300">
          {t.planCapped}{" "}
          <Link href="/pricing" className="underline hover:text-amber-200">
            {t.upgradeCta}
          </Link>
        </p>
      )}
      {error && <p className="text-xs text-red-400">{t.errorPrefix} {error}</p>}
    </div>
  );
}
