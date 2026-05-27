"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Renders the "about this genre" paragraph. If the server-rendered initial
 * description is null (first visit — cache miss), this component kicks off
 * a background fetch to `/api/genre/warm` to fill it. The page stays
 * cheap to render; the description fades in once the lazy fetch returns.
 *
 * Triggered out-of-band specifically to dodge Workers' per-request CPU
 * cap, which a synchronous Gemini call was blowing past — see
 * `apps/web/src/lib/genreDetail.ts:loadGenreInfo`.
 */
export function AboutBox({
  name,
  initial,
  locale,
  emptyText,
  warmingText,
}: {
  name: string;
  initial: string | null;
  locale: Locale;
  emptyText: string;
  warmingText: string;
}) {
  const [text, setText] = useState<string | null>(initial);
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    if (text || warming) return;
    let cancelled = false;
    setWarming(true);
    (async () => {
      try {
        const res = await fetch("/api/genre/warm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as {
          descriptionEn?: string | null;
          descriptionKo?: string | null;
        };
        const picked = locale === "ko" ? d.descriptionKo : d.descriptionEn;
        if (!cancelled && picked) setText(picked);
      } catch {
        /* swallow — fall back to emptyText */
      } finally {
        if (!cancelled) setWarming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, locale, text, warming]);

  return (
    <p className="text-sm leading-relaxed text-neutral-300">
      {text ?? (warming ? warmingText : emptyText)}
    </p>
  );
}
