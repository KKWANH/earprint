"use client";

import { useState } from "react";
import { deleteAccount } from "./account-actions";
import type { Locale } from "@/lib/i18n";
import { accountDict } from "@/lib/i18n/account";

/**
 * Three-state account deletion control:
 *
 *   1. idle     — single button. Click promotes to "confirming".
 *   2. confirming — explains scope + requires the user to type the literal
 *                   word "DELETE" before the confirm button enables. Cheap
 *                   friction; designed to catch accidental clicks on the
 *                   irreversible action. The exact string match is
 *                   case-sensitive on purpose — "delete" / "Delete" do
 *                   not pass, so muscle-memory completion doesn't count.
 *   3. submitting — the server action is in flight. Buttons disabled so
 *                   the user can't double-fire while signOut races.
 *
 * Backups: per Privacy Policy, Neon retains encrypted PITR snapshots up
 * to 7 days. The copy says "we cannot restore from backups" — that is
 * operationally accurate: we don't access backups for individual user
 * restore requests; they exist solely for disaster recovery.
 */
const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountButton({ locale }: { locale: Locale }) {
  const t = accountDict(locale);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const canSubmit = typed === CONFIRM_PHRASE && !submitting;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4">
      <p className="text-xs leading-relaxed text-rose-200">
        {t.deleteConfirmWarn}
      </p>
      <label className="flex flex-col gap-1.5 text-xs text-rose-200">
        <span>{t.deleteTypeToConfirm}</span>
        <input
          autoFocus
          spellCheck={false}
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t.deleteTypePlaceholder}
          className="rounded-md border border-rose-500/40 bg-black/40 px-2.5 py-1.5 font-mono text-sm text-rose-100 outline-none focus:border-rose-400"
        />
      </label>
      <div className="flex gap-2">
        <form
          action={async () => {
            // Submission goes through the server action regardless — but
            // the button is disabled until `canSubmit` so this only fires
            // when the typed phrase matches exactly.
            setSubmitting(true);
            await deleteAccount();
          }}
        >
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.deleteConfirmYes}
          </button>
        </form>
        <button
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          disabled={submitting}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-40"
        >
          {t.deleteCancel}
        </button>
      </div>
    </div>
  );
}
