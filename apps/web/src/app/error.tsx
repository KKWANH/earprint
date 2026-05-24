"use client";

import Link from "next/link";
import { useMemo } from "react";
import { dicts, type Locale } from "@/lib/i18n";

/** Reads the locale cookie client-side — error.tsx renders before any server
 * helper can pass `locale` down, so we sniff the cookie directly. */
function useLocaleFromCookie(): Locale {
  return useMemo<Locale>(() => {
    if (typeof document === "undefined") return "en";
    const m = document.cookie.match(/(?:^|; )locale=(en|ko)/);
    return (m?.[1] as Locale) ?? "en";
  }, []);
}

/** Route-level error boundary — catches render/runtime errors in a page. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const locale = useLocaleFromCookie();
  const t = dicts[locale].errors;
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-xl font-bold">{t.title}</h1>
      <p className="text-sm text-neutral-400">{t.body}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          {t.retry}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-5 py-2 text-sm font-medium text-neutral-300 hover:bg-white/5"
        >
          {t.home}
        </Link>
      </div>
    </main>
  );
}
