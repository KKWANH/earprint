import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { PAYMENTS_ENABLED } from "@/lib/constants";
import { getLocale } from "@/lib/i18n-server";
import { pricingDict } from "@/lib/i18n/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = pricingDict(locale);
  const title = `${t.pageTitle} — Earprint`;
  const description =
    locale === "ko"
      ? "Earprint 요금제 — 무료 미리보기와 1회 결제 분석. 구독 없음, 한 번에 한 분석."
      : "Earprint pricing — free preview and per-analysis credits. No subscription, pay only when you run an analysis.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: "https://earprint.kwanho.dev/pricing" },
  };
}

/**
 * Public pricing page. Two SKUs: Free (starter credit + base library) and
 * Single Analysis (one-off top-up). The Pro monthly subscription is
 * paused until the analysis-history feature ships — no real "why
 * subscribe" story without month-over-month taste comparison. The
 * design renders even when PAYMENTS_ENABLED is off so it's testable;
 * CTAs disable + a "coming soon" banner appears at the top.
 */
export default async function PricingPage() {
  const locale = await getLocale();
  const t = pricingDict(locale);
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
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

      {/* 3 plans now (Free / Single / 3-pack). On small screens they
          stack; on tablet they go 2-up wrapping, on desktop 3-up. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Free */}
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-7">
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
            className="mt-auto rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-neutral-500"
          >
            {t.free.cta}
          </button>
        </div>

        {/* Single Analysis — one-shot credit */}
        <div className="relative flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-neutral-950 to-neutral-900 p-5 sm:p-7">
          <div>
            <h2 className="text-xl font-bold">{t.analysis.name}</h2>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-emerald-200">
                {t.analysis.price}
              </span>
              <span className="text-sm text-neutral-500">/ {t.analysis.period}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-neutral-300">{t.analysis.desc}</p>
          {PAYMENTS_ENABLED ? (
            <UpgradeButton
              href="/api/lemon/checkout?variant=analysis"
              primary
              signedIn={signedIn}
            >
              {t.analysis.cta}
            </UpgradeButton>
          ) : (
            <button
              disabled
              className="mt-auto rounded-md bg-emerald-500/40 px-4 py-2 text-sm font-semibold text-black/70"
            >
              {t.analysis.cta}
            </button>
          )}
        </div>

        {/* 3-pack — bundle, headline value play */}
        <div className="relative flex flex-col gap-4 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/30 via-neutral-950 to-neutral-900 p-5 sm:p-7">
          <span className="absolute -top-3 right-4 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
            {t.triple.saveLabel}
          </span>
          <div>
            <h2 className="text-xl font-bold">{t.triple.name}</h2>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-amber-200">
                {t.triple.price}
              </span>
              <span className="text-sm text-neutral-500">/ {t.triple.period}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-neutral-300">{t.triple.desc}</p>
          {PAYMENTS_ENABLED ? (
            <UpgradeButton
              href="/api/lemon/checkout?variant=triple"
              primary
              signedIn={signedIn}
            >
              {t.triple.cta}
            </UpgradeButton>
          ) : (
            <button
              disabled
              className="mt-auto rounded-md bg-amber-400/40 px-4 py-2 text-sm font-semibold text-black/70"
            >
              {t.triple.cta}
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{t.comparison.title}</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wider text-neutral-500 sm:text-xs">
                <th className="px-3 py-3 font-medium sm:px-4">{t.pageTitle}</th>
                <th className="px-3 py-3 font-medium sm:px-4">{t.free.name}</th>
                <th className="px-3 py-3 font-medium text-emerald-300 sm:px-4">
                  {t.analysis.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {t.comparison.rows.map((r) => (
                <tr key={r.feature} className="border-b border-neutral-800/60 last:border-0">
                  <td className="px-3 py-2.5 text-neutral-300 sm:px-4">{r.feature}</td>
                  <td className="px-3 py-2.5 text-neutral-400 sm:px-4">{r.free}</td>
                  <td className="px-3 py-2.5 text-emerald-200 sm:px-4">{r.paid}</td>
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
    ? "mt-auto rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
    : "mt-auto rounded-md border border-emerald-500/40 px-4 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/10";
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
