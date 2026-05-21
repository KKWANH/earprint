"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n";

/** EN / KO language switch — stores the choice in a cookie and refreshes. */
export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(next: Locale) {
    if (next === locale) return;
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex shrink-0 items-center rounded-md border border-white/10 text-xs">
      {(["en", "ko"] as Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => pick(l)}
          disabled={pending}
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
