"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n";
import { accountDict } from "@/lib/i18n/account";
import { rotateSyncToken } from "./sync-token-actions";

/** Two-step confirm — rotating the token immediately invalidates the
 *  extension's existing pairing, so we don't want a single-click footgun. */
export function RotateSyncTokenButton({ locale }: { locale: Locale }) {
  const t = accountDict(locale);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function run() {
    startTransition(async () => {
      try {
        await rotateSyncToken();
        setDone(true);
        setConfirming(false);
      } catch {
        /* leave confirming state for user to retry */
      }
    });
  }

  if (done) {
    return (
      <p className="text-xs text-emerald-300">{t.syncTokenRotated}</p>
    );
  }
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="self-start rounded-md border border-amber-500/40 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/10"
      >
        {t.syncTokenRotateButton}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-amber-300">{t.syncTokenRotateWarn}</p>
      <div className="flex gap-2">
        <button
          onClick={run}
          disabled={pending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {pending ? t.syncTokenRotating : t.syncTokenRotateConfirm}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
        >
          {t.deleteCancel}
        </button>
      </div>
    </div>
  );
}
