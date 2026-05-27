import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { securityDict } from "@/lib/i18n/security";

export async function generateMetadata(): Promise<Metadata> {
  const t = securityDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/** Contact + security-research reference. The contact form / Resend
 *  send path was removed (RESEND-REMOVE) — the maintainer prefers
 *  direct mailto: and GitHub Issues over an in-app form that depends
 *  on a verified Resend sending domain and a working SMTP/HTTP path
 *  for KR-located requests. */
const CONTACT_EMAIL = "kwanho0096@gmail.com";
const GITHUB_ISSUES = "https://github.com/KKWANH/earprint/issues/new";

export default async function SecurityPage() {
  const locale = await getLocale();
  const t = securityDict(locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t.pageTitle}</h1>
        <p className="text-sm leading-relaxed text-neutral-400">{t.intro}</p>
      </header>

      <Section title={t.contactCardTitle}>
        <p className="text-sm leading-relaxed text-neutral-400">{t.contactCardBody}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=%5BEarprint%5D%20`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            📧 {t.contactEmailLabel}
          </a>
          <a
            href={GITHUB_ISSUES}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-white/30 hover:text-white"
          >
            🐙 {t.contactGithubLabel} ↗
          </a>
        </div>
        <p className="text-[11px] text-neutral-500">{t.contactGithubHint}</p>
        <p className="select-all rounded-md bg-black/30 px-3 py-2 font-mono text-xs text-neutral-300">
          {CONTACT_EMAIL}
        </p>
      </Section>

      <div className="flex flex-col gap-3 border-t border-white/5 pt-6">
        <h2 className="text-lg font-bold">{t.securityRefHeading}</h2>
        <p className="text-sm leading-relaxed text-neutral-400">
          {t.securityRefBody}
        </p>
      </div>

      <Section title={t.scopeTitle}>
        <p className="text-sm text-neutral-200">{t.scopeInLabel}</p>
        <ul className="ml-4 list-disc text-sm text-neutral-400">
          {t.scopeIn.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-neutral-200">{t.scopeOutLabel}</p>
        <ul className="ml-4 list-disc text-sm text-neutral-500">
          {t.scopeOut.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section title={t.safeHarborTitle}>
        <p className="text-sm leading-relaxed text-neutral-300">{t.safeHarborBody}</p>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-neutral-300">
          {t.safeHarborRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-neutral-500">{t.safeHarborTail}</p>
      </Section>

      <Section title={t.slaTitle}>
        <p className="text-sm leading-relaxed text-neutral-300">{t.slaBody}</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
