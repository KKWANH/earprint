"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { onboardingDict } from "@/lib/i18n/onboarding";
import { CURRENT_TOS_VERSION } from "@/lib/constants";
import { saveConsent } from "./actions";

/** Three-checkbox consent form. Age + ToS are required to submit. */
export function OnboardingForm({
  locale,
  errored,
}: {
  locale: Locale;
  errored: boolean;
}) {
  const t = onboardingDict(locale);
  const [age, setAge] = useState(false);
  const [tos, setTos] = useState(false);
  const [ai, setAi] = useState(false);
  const ready = age && tos;

  return (
    <form action={saveConsent} className="flex flex-col gap-5">
      <Check
        name="age"
        checked={age}
        onChange={setAge}
        label={t.age.label}
        hint={t.age.hint}
        required
      />
      <Check
        name="tos"
        checked={tos}
        onChange={setTos}
        label={t.tos.label}
        required
        hint={
          <>
            {t.tos.hintPrefix}{" "}
            <Link href="/terms" className="underline hover:text-white">
              {t.tos.terms}
            </Link>
            {" · "}
            <Link href="/privacy" className="underline hover:text-white">
              {t.tos.privacy}
            </Link>
            <br />
            <span className="text-neutral-600">
              {t.tos.hintSuffix.replace("{VERSION}", CURRENT_TOS_VERSION)}
            </span>
          </>
        }
      />
      <Check
        name="ai"
        checked={ai}
        onChange={setAi}
        label={t.ai.label}
        hint={t.ai.hint}
      />

      {errored && (
        <p className="text-sm text-rose-400">{t.required}</p>
      )}

      <button
        type="submit"
        disabled={!ready}
        className="self-start rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t.submit}
      </button>
    </form>
  );
}

function Check({
  name,
  checked,
  onChange,
  label,
  hint,
  required,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-emerald-500"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-neutral-100">
          {label}
          {required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        <span className="text-xs leading-relaxed text-neutral-500">{hint}</span>
      </div>
    </label>
  );
}
