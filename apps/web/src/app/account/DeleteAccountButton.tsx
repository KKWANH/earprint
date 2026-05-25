"use client";

import { useState } from "react";
import { deleteAccount } from "./account-actions";
import type { Locale } from "@/lib/i18n";
import { accountDict } from "@/lib/i18n/account";

/** Two-step account deletion control. */
export function DeleteAccountButton({ locale }: { locale: Locale }) {
  const t = accountDict(locale);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="self-start rounded-md border border-rose-500/40 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10"
      >
        {t.deleteAccount}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-rose-300">{t.deleteConfirmWarn}</p>
      <div className="flex gap-2">
        <form action={deleteAccount}>
          <button className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500">
            {t.deleteConfirmYes}
          </button>
        </form>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
        >
          {t.deleteCancel}
        </button>
      </div>
    </div>
  );
}
