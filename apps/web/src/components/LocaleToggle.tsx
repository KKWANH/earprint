"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n-actions";
import type { Locale } from "@/lib/i18n";

/**
 * EN / KO language switch. We call the server action and then refresh the
 * router explicitly — revalidatePath alone re-runs the layout with the
 * stale incoming cookies, so the page would only flip on the next refresh.
 */
export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const pick = (l: Locale) => {
    if (l === locale || pending) return;
    // Write the cookie client-side first — the server action's Set-Cookie
    // can otherwise arrive after router.refresh() has already re-fetched,
    // leaving the page on the old locale (this is why EN→KO got "stuck"
    // and KO→EN looked slow, since "en" is the fallback default).
    document.cookie = `locale=${l};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(async () => {
      await setLocale(l);
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 items-center rounded-md border border-white/10 text-xs">
      {(["en", "ko"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          disabled={pending}
          className={`px-2 py-1 transition-colors disabled:opacity-50 ${
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
