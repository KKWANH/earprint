import type { Metadata } from "next";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";
import { getLocale } from "@/lib/i18n-server";
import { guideDict } from "@/lib/i18n/guide";

export async function generateMetadata(): Promise<Metadata> {
  const t = guideDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * Public setup walkthrough. Reachable from the landing install card and from
 * the footer — written to stand on its own so users land here from a tweet
 * and still understand the whole flow.
 */
export default async function GuidePage() {
  const locale = await getLocale();
  const t = guideDict(locale);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
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
      </header>

      {/* Video tutorial slot. Kept as a placeholder until a real walkthrough
          is recorded — the box reserves the layout space so the page doesn't
          jump when it's filled in. */}
      <section className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-sm text-neutral-500">
        🎬 {t.videoComing}
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
