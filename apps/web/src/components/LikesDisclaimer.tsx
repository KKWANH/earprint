import type { Locale } from "@/lib/i18n";

const COPY: Record<Locale, string> = {
  en:
    "Earprint analyses your YouTube Music likes — not your actual play history. A liked song isn't necessarily one you listen to often, and a song you listen to constantly may not be liked. Read each metric with that in mind.",
  ko:
    "Earprint 는 YouTube Music 좋아요 곡을 분석합니다 — 실제 재생 기록이 아닙니다. 좋아요 곡이 자주 듣는 곡과 같지 않고, 자주 듣는 곡이 좋아요에 없을 수도 있습니다. 이 점을 감안하고 결과를 보세요.",
};

/**
 * Small one-liner that sits at the top of any page rendering an inference
 * over the user's library. We say "likes != listens" up-front so the
 * results read as analysis-of-likes rather than analysis-of-taste — which
 * is the honest framing and protects the user's expectations.
 */
export function LikesDisclaimer({ locale }: { locale: Locale }) {
  return (
    <p className="rounded-lg border border-amber-500/15 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-200/70">
      ℹ {COPY[locale]}
    </p>
  );
}
