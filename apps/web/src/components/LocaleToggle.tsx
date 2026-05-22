"use client";

import { setLocale } from "@/lib/i18n-actions";
import type { Locale } from "@/lib/i18n";

/** EN / KO language switch — submits a server action so the choice is
 *  written authoritatively and survives a refresh. */
export function LocaleToggle({ locale }: { locale: Locale }) {
  return (
    <div className="flex shrink-0 items-center rounded-md border border-white/10 text-xs">
      {(["en", "ko"] as Locale[]).map((l) => (
        <form key={l} action={setLocale.bind(null, l)}>
          <button
            type="submit"
            className={`px-2 py-1 transition-colors ${
              l === locale
                ? "rounded-[5px] bg-white/15 font-semibold text-white"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            {l.toUpperCase()}
          </button>
        </form>
      ))}
    </div>
  );
}
