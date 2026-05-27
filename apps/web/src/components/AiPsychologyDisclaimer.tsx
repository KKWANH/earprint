import type { Locale } from "@/lib/i18n";

/**
 * The visible-above-the-fold notice that frames every AI-generated psychology /
 * profile output as entertainment + self-reflection — never a diagnosis,
 * never inferring sensitive categories (religion, political views, mental
 * health, sexuality, race) under GDPR Art. 9. Mounted on /profile, /dna,
 * and /s/[shareId] so a viewer never sees AI psychology copy without it.
 *
 * Why visible (not in tooltip / Terms only): a Gemini-generated "you are X"
 * persona reads as authoritative even when it isn't. The disclaimer needs
 * to share the screen, not be discoverable.
 */
const COPY: Record<Locale, { title: string; body: string }> = {
  en: {
    title: "About this AI analysis",
    body:
      "This persona, score, and commentary are AI-generated interpretations of your liked-songs metadata. They are intended for entertainment and self-reflection — not a psychological assessment, medical advice, or factual claim about you. Earprint deliberately does not infer sensitive traits such as religion, political views, race, sexual orientation, or mental health.",
  },
  ko: {
    title: "이 AI 분석에 대하여",
    body:
      "여기 표시된 페르소나·점수·해석은 좋아요 곡 메타데이터를 바탕으로 AI 가 생성한 해석입니다. 오락 및 자기 성찰 목적으로 제공되며, 심리 진단·의학적 조언·당신에 관한 사실적 단정이 아닙니다. Earprint 는 종교·정치적 견해·인종·성적 지향·정신 건강과 같은 민감 정보 추론을 의도적으로 피합니다.",
  },
};

export function AiPsychologyDisclaimer({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  return (
    <aside className="rounded-lg border border-indigo-500/20 bg-indigo-950/30 px-3 py-2.5 text-[11px] leading-relaxed text-indigo-200/85">
      <strong className="font-semibold text-indigo-200">ℹ {c.title}</strong>
      <span className="ml-1 text-indigo-200/75">— {c.body}</span>
    </aside>
  );
}
