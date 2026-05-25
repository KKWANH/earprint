import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { PAYMENTS_ENABLED } from "@/lib/constants";
import { getLocale } from "@/lib/i18n-server";
import { pricingDict } from "@/lib/i18n/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const t = pricingDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * Public-facing pricing page. Renders the Free vs Pro split even when
 * PAYMENTS_ENABLED is off so the design is testable; the CTA buttons just
 * stay disabled with a "coming soon" banner.
 */
export default async function PricingPage() {
  const locale = await getLocale();
  const t = pricingDict(locale);
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.pageTitle}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-neutral-400">
          {t.tagline}
        </p>
        {!PAYMENTS_ENABLED && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-950/30 px-4 py-2 text-xs text-amber-200/85">
            {t.comingSoon}
          </p>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-7">
          <div>
            <h2 className="text-xl font-bold">{t.free.name}</h2>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold">{t.free.price}</span>
              <span className="text-sm text-neutral-500">/ {t.free.period}</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-neutral-300">
            {t.free.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-neutral-600">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-neutral-500"
          >
            {t.free.cta}
          </button>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 p-7">
          <span className="absolute -top-2.5 left-7 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-black">
            {t.pro.badge}
          </span>
          <div>
            <h2 className="text-xl font-bold">{t.pro.name}</h2>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-extrabold">{t.pro.monthly}</span>
              <span className="text-sm text-neutral-500">·</span>
              <span className="text-sm text-neutral-300">{t.pro.lifetime}</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-neutral-200">
            {t.pro.perks.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {PAYMENTS_ENABLED ? (
            <div className="mt-2 flex flex-col gap-2">
              <UpgradeButton
                href="/api/lemon/checkout?variant=monthly"
                primary
                signedIn={signedIn}
              >
                {t.pro.monthlyCta}
              </UpgradeButton>
              <UpgradeButton
                href="/api/lemon/checkout?variant=lifetime"
                signedIn={signedIn}
              >
                {t.pro.lifetimeCta}
              </UpgradeButton>
            </div>
          ) : (
            <button
              disabled
              className="mt-2 rounded-md bg-emerald-500/40 px-4 py-2 text-sm font-semibold text-black/70"
            >
              {t.pro.monthlyCta}
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{t.comparison.title}</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">{t.pageTitle}</th>
                <th className="px-4 py-3 font-medium">{t.free.name}</th>
                <th className="px-4 py-3 font-medium text-emerald-300">{t.pro.name}</th>
              </tr>
            </thead>
            <tbody>
              {t.comparison.rows.map((r) => (
                <tr key={r.feature} className="border-b border-neutral-800/60 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-300">{r.feature}</td>
                  <td className="px-4 py-2.5 text-neutral-400">{r.free}</td>
                  <td className="px-4 py-2.5 text-emerald-200">{r.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{t.faqTitle}</h2>
        <div className="flex flex-col gap-3">
          {t.faq.map((f, i) => (
            <details
              key={i}
              className="group rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-200 marker:hidden group-open:text-white">
                <span className="mr-1.5 text-neutral-500 group-open:text-emerald-400">▸</span>
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

function UpgradeButton({
  href,
  children,
  primary,
  signedIn,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  signedIn: boolean;
}) {
  const cls = primary
    ? "rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
    : "rounded-md border border-emerald-500/40 px-4 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/10";
  // Not signed in? Send them through Google sign-in first, then bounce back
  // to the checkout link.
  const finalHref = signedIn
    ? href
    : `/api/auth/signin?callbackUrl=${encodeURIComponent(href)}`;
  return (
    <Link href={finalHref} className={cls}>
      {children}
    </Link>
  );
}
