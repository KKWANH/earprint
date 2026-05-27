"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-translates the user's stored AI profile to their current UI
 * locale when the matching column is empty. Fires on mount, then reloads
 * the page so the freshly-translated text shows up where the original
 * was. Side-effect free if the translate succeeds (just visual refresh).
 *
 * Why automatic: the alternative is a "Translate to Korean? [button]"
 * banner, but the user already switched their UI to Korean — that's the
 * explicit intent. Translation cost via flash-lite is ~$0.001, which is
 * cheap enough to spend without a per-call confirmation prompt.
 *
 * The companion server endpoint at /api/profile/translate handles the
 * actual Gemini call + DB cache; this component just kicks it.
 */
export function AutoTranslateBanner({
  target,
  shareId,
  t,
}: {
  target: "en" | "ko";
  /** Set when the caller is /s/[shareId] — translates the shared
   *  profile rather than the user's own. */
  shareId?: string;
  t: { localeMismatch: string };
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"translating" | "done" | "failed">(
    "translating",
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/profile/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, shareId }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setPhase("failed");
          return;
        }
        setPhase("done");
        // Soft refresh — re-runs the server component with the
        // freshly-cached translation, no jarring full reload.
        router.refresh();
      } catch {
        if (!cancelled) setPhase("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label =
    phase === "translating"
      ? target === "ko"
        ? "🌐 한국어로 번역 중…"
        : "🌐 Translating to English…"
      : phase === "failed"
        ? t.localeMismatch
        : null;
  if (!label) return null;
  return <p className="text-xs text-amber-400">{label}</p>;
}
