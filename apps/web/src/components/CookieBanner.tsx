"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

const STORAGE_KEY = "earprint.cookie.dismissed";

const COPY: Record<Locale, { body: string; link: string; cta: string }> = {
  en: {
    body:
      "Earprint only uses strictly-necessary cookies (sign-in, locale). No analytics, no ad trackers — promise.",
    link: "Privacy",
    cta: "Got it",
  },
  ko: {
    body:
      "Earprint 는 꼭 필요한 쿠키만 사용합니다 (로그인·언어). 분석·광고 추적 쿠키 없음.",
    link: "개인정보처리방침",
    cta: "확인",
  },
};

/**
 * Minimal cookie notice. Since every cookie we set is strictly necessary
 * under ePrivacy, formal consent isn't required — but a transparent
 * one-time banner is the friendly thing to do and protects against the
 * day we add analytics.
 */
export function CookieBanner({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [show, setShow] = useState(false);

  // Defer until after hydration so the banner doesn't flash on SSR for
  // returning visitors.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // Private mode / storage blocked — just don't show, no functional harm.
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-white/10 bg-neutral-900/95 px-4 py-3 text-xs leading-relaxed text-neutral-300 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1">
          🍪 {t.body}{" "}
          <Link href="/privacy" className="underline hover:text-white">
            {t.link}
          </Link>
          .
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-200"
        >
          {t.cta}
        </button>
      </div>
    </div>
  );
}
