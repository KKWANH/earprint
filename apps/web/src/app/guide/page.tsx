import type { Metadata } from "next";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";
import { getLocale } from "@/lib/i18n-server";
import { guideDict } from "@/lib/i18n/guide";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = guideDict(locale);
  const title = `${t.pageTitle} — Earprint`;
  const description =
    locale === "ko"
      ? "Earprint 설치 가이드 — Chrome 확장 설치부터 YouTube Music 좋아요 동기화, AI 음악 분석까지 5단계. 자주 묻는 질문 포함."
      : "Earprint setup guide — install the Chrome extension, sync your YouTube Music liked songs, get your AI music analysis. Five steps plus FAQ.";
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: "https://earprint.kwanho.dev/guide" },
  };
}

/**
 * Public setup walkthrough. Reachable from the landing install card and from
 * the footer — written to stand on its own so users land here from a tweet
 * and still understand the whole flow.
 */
export default async function GuidePage() {
  const locale = await getLocale();
  const t = guideDict(locale);

  // Structured data so Google can render the FAQs as rich results on the
  // SERP — each accordion item becomes a Question/Answer pair. Built from
  // the same i18n source as the visible accordion so they can never drift.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <header className="flex flex-col gap-3 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.pageTitle}
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-neutral-400">
          {t.intro}
        </p>
        <div className="mt-2 flex flex-col items-center gap-2">
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            {t.installCta}
          </a>
          <span className="text-[11px] text-neutral-500">{t.installNote}</span>
        </div>
        <p className="mx-auto mt-2 max-w-md rounded-lg border border-amber-500/20 bg-amber-950/30 px-4 py-3 text-xs leading-relaxed text-amber-200/85">
          {t.mobileNote}
        </p>
      </header>

      {/* "Why an extension?" card — replaced the old empty video-walkthrough
          placeholder. That placeholder read as a half-finished page and gave
          no value; the most common drop-off question at the install step is
          "wait, why do I need to install a browser extension to read my own
          liked songs?", and answering it inline directly converts skeptics
          (the YouTube Music API gap, the read-only nature, what's actually
          sent). The reassurance text is duplicated near the install CTA on
          the landing page — duplication is intentional. */}
      <section className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 sm:p-6">
        <h2 className="text-base font-bold text-indigo-200">
          {t.whyExtensionTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-indigo-100/85">
          {t.whyExtensionBody}
        </p>
      </section>

      <ol className="flex flex-col gap-5">
        {t.steps.map((s, i) => (
          <li
            key={i}
            className="flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-black">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold text-white">{s.title}</h2>
              <p className="text-sm leading-relaxed text-neutral-300">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{t.faqTitle}</h2>
        <div className="flex flex-col gap-3">
          {t.faq.map((f, i) => (
            <details
              key={i}
              className="group rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4 open:bg-neutral-900/80"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-200 marker:hidden group-open:text-white">
                <span className="mr-1.5 text-neutral-500 group-open:text-emerald-400">
                  ▸
                </span>
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
