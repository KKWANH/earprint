import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { securityDict } from "@/lib/i18n/security";

export async function generateMetadata(): Promise<Metadata> {
  const t = securityDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * Responsible-disclosure policy. Mirrored in /.well-known/security.txt so
 * automated scanners and security researchers can find the contact route.
 */
export default async function SecurityPage() {
  const locale = await getLocale();
  const t = securityDict(locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t.pageTitle}</h1>
        <p className="text-sm leading-relaxed text-neutral-400">{t.intro}</p>
      </header>

      <Section title={t.contactTitle}>
        <p className="text-sm text-neutral-300">
          {t.contactLine}{" "}
          <a
            href={`mailto:${t.contactEmail}?subject=Earprint%20security%20report`}
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            {t.contactEmail}
          </a>
        </p>
        <p className="text-xs text-neutral-500">{t.pgpNote}</p>
      </Section>

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
      </Section>

      <Section title={t.rewardTitle}>
        <p className="text-sm leading-relaxed text-neutral-300">{t.rewardBody}</p>
      </Section>

      <Section title={t.slaTitle}>
        <p className="text-sm leading-relaxed text-neutral-300">{t.slaBody}</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
