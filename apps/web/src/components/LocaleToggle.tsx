"use client";

import type { Locale } from "@/lib/i18n";

/**
 * EN / KO language switch.
 *
 * The cookie is written client-side and the page is hard-reloaded — soft
 * router refreshes raced the server action's Set-Cookie header in both
 * directions, leaving the page on the old locale. A reload is the boring,
 * reliable option: the browser already has the new cookie before the next
 * request goes out.
 */
export function LocaleToggle({ locale }: { locale: Locale }) {
  const pick = (l: Locale) => {
    if (l === locale) return;
    document.cookie = `locale=${l};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    window.location.reload();
  };

  return (
    <div className="flex shrink-0 items-center rounded-md border border-white/10 text-xs">
      {(["en", "ko"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          className={`px-2 py-1 transition-colors ${
            l === locale
              ? "rounded-[5px] bg-white/15 font-semibold text-white"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
