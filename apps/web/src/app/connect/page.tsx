import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getLibrarySummary } from "@/lib/connection";
import { requireOnboarded } from "@/lib/onboarding";
import { getLocale } from "@/lib/i18n-server";
import { connectDict } from "@/lib/i18n/connect";
import { ApiSyncButton } from "./ApiSyncButton";
import { TokenBox } from "./TokenBox";

export async function generateMetadata(): Promise<Metadata> {
  const t = connectDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

export default async function ConnectPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = connectDict(locale);

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/connect" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.loginGoogle}
          </button>
        </form>
      </main>
    );
  }

  const { userId, token } = await requireOnboarded();
  const { count, recent } = await getLibrarySummary(userId);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="text-sm text-neutral-400">{session.user.email}</p>
      </header>

      {/* Machine-readable token — the extension's content script reads this
          so the user never has to copy-paste it. */}
      <span id="pa-sync-token" data-token={token} hidden />

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">{t.syncTokenTitle}</h2>
        <p className="text-sm text-neutral-400">{t.syncTokenDesc}</p>
        <TokenBox token={token} locale={locale} />
      </section>

      {/* API sub-method sync — for mobile and as a fallback. Pulls YouTube
          Liked Videos via the official Data API (partial coverage). */}
      <section className="flex flex-col gap-3 rounded-xl border border-emerald-900/40 bg-neutral-900 p-6">
        <div className="flex items-center gap-2">
          <span aria-hidden>📱</span>
          <h2 className="font-semibold">{t.apiSyncTitle}</h2>
        </div>
        <p className="text-sm text-neutral-400">{t.apiSyncDesc}</p>
        <p className="rounded-md bg-amber-950/40 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
          ⚠ {t.apiSyncNote}
        </p>
        <ApiSyncButton locale={locale} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">{t.libraryTitle(count)}</h2>
          <Link
            href="/library"
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-900"
          >
            {t.analysisDashboard}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.noSyncedSongs}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {recent.map((t, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate">{t.title}</span>
                <span className="shrink-0 text-neutral-500">{t.artist}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
