"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n";
import { accountDict } from "@/lib/i18n/account";
import { setAiConsent } from "./ai-consent-actions";

/** Click-to-toggle AI profiling consent, optimistically updated. */
export function AiConsentToggle({
  initialGranted,
  locale,
}: {
  initialGranted: boolean;
  locale: Locale;
}) {
  const t = accountDict(locale);
  const [granted, setGranted] = useState(initialGranted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !granted;
    setGranted(next);
    startTransition(async () => {
      try {
        await setAiConsent(next);
      } catch {
        setGranted(!next); // revert on error
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={granted}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        granted ? "bg-emerald-500" : "bg-neutral-700"
      } disabled:opacity-50`}
    >
      <span className="sr-only">{t.aiConsentLabel}</span>
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          granted ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
