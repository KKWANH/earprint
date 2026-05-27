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
  const [needsCredit, setNeedsCredit] = useState(false);
  const [needsAiConsent, setNeedsAiConsent] = useState(false);
  const [regionUnavailable, setRegionUnavailable] = useState(false);

  async function go() {
    setBusy(true);
    setError(null);
    setCapped(false);
    setNeedsCredit(false);
    setNeedsAiConsent(false);
    setRegionUnavailable(false);
    let succeeded = false;
    try {
      const res = await fetch("/api/profile", { method: "POST" });
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        capped?: boolean;
        needsCredit?: boolean;
        needsAiConsent?: boolean;
        regionUnavailable?: boolean;
      };
      if (d.needsAiConsent) setNeedsAiConsent(true);
      else if (d.needsCredit) setNeedsCredit(true);
      else if (d.capped) setCapped(true);
      else if (d.regionUnavailable) setRegionUnavailable(true);
      else if (!d.ok) setError(d.error ?? `${t.errorStatus} ${res.status}`);
      else succeeded = true;
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      if (succeeded) {
        // Hard reload on success — tester reported router.refresh() not
        // surfacing the new axisScores card / persona / etc. on the
        // re-rendered profile page. router.refresh re-fetches the RSC
        // but the OpenNext-on-Cloudflare cache layer + the page's
        // mount state sometimes hold onto stale data. window.location
        // .reload() is the bulletproof "give me the new analysis" path
        // — slow (~200ms) but visibly correct.
        window.location.reload();
      } else {
        // Non-success: a soft refresh is enough (lets credit-state UI
        // re-render etc.).
        router.refresh();
      }
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
      {needsCredit && (
        <p className="text-xs leading-relaxed text-amber-300">
          {t.needsCredit}{" "}
          <Link href="/pricing" className="underline hover:text-amber-200">
            {t.upgradeCta}
          </Link>
        </p>
      )}
      {needsAiConsent && (
        <p className="text-xs leading-relaxed text-amber-300">
          {t.needsAiConsent}{" "}
          <Link href="/account" className="underline hover:text-amber-200">
            {t.accountLink}
          </Link>
        </p>
      )}
      {regionUnavailable && (
        <p className="text-xs leading-relaxed text-amber-300">{t.regionUnavailable}</p>
      )}
      {error && <p className="text-xs text-red-400">{t.errorPrefix} {error}</p>}
    </div>
  );
}
