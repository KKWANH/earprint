import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";
import { getLastSyncStatus, getLibrarySummary } from "@/lib/connection";
import { requireOnboarded } from "@/lib/onboarding";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
import { connectDict } from "@/lib/i18n/connect";
import { TokenBox } from "./TokenBox";

export async function generateMetadata(): Promise<Metadata> {
  const t = connectDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * /connect — single-mode flow now that the YouTube Data API path was
 * removed. The Data API only ships the user's YouTube "Liked Videos"
 * playlist, but YouTube Music's "Liked Music" is a separate list the
 * API doesn't expose — testers consistently saw 20-30% of their actual
 * library, missing the 70%+ that lives as album tracks without a
 * dedicated video. The Chrome extension reads the real Liked Music
 * page in the user's own logged-in tab, so it's the only path that
 * actually covers a YT Music library.
 */
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
  const [{ count, recent }, lastSync] = await Promise.all([
    getLibrarySummary(userId),
    getLastSyncStatus(userId),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12 sm:py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="text-sm text-neutral-400">{session.user.email}</p>
      </header>

      {/* Machine-readable token — the extension's content script reads this
          on /connect so the user never has to copy-paste it. */}
      <span id="pa-sync-token" data-token={token} hidden />

      <section className="flex flex-col gap-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-2xl" aria-hidden>
            🧩
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="text-lg font-bold">{t.installTitle}</h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t.installBody}
            </p>
          </div>
        </div>

        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          {t.installCta} ↗
        </a>

        <ol className="ml-5 list-decimal text-sm leading-relaxed text-neutral-300 marker:text-emerald-400">
          {t.installSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 rounded-md border border-white/5 bg-black/20 p-3">
          <p className="text-xs font-semibold text-neutral-300">{t.syncTokenTitle}</p>
          <p className="text-[11px] text-neutral-500">{t.syncTokenDesc}</p>
          <TokenBox token={token} locale={locale} />
        </div>

        <p className="rounded-md border border-white/5 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-neutral-400">
          🔐 {t.privacyNote}
        </p>
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
        {lastSync && <LastSyncBadge status={lastSync} locale={locale} />}
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

/**
 * Compact one-liner under the library count summarising the user's last
 * extension sync. Sync is append-only so there's no complete/partial
 * branching to display — every successful sync just adds.
 */
function LastSyncBadge({
  status,
  locale,
}: {
  status: import("@/lib/connection").LastSyncStatus;
  locale: Locale;
}) {
  const t = connectDict(locale);
  const ago = formatRelative(status.at, locale);
  const captured = status.captured ?? 0;
  const expected = status.expected;
  const short =
    expected != null && captured < Math.floor(expected * 0.99);
  const headerHint = short
    ? t.lastSyncHeaderHint(expected!.toLocaleString())
    : "";
  return (
    <p className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200">
      {t.lastSyncLine(captured.toLocaleString(), headerHint, ago)}
    </p>
  );
}

/** "12 minutes ago" / "12분 전" — coarse, no need for a date library. */
function formatRelative(iso: string, locale: Locale): string {
  const t = connectDict(locale);
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return t.relJustNow;
  if (min < 60) return t.relMinAgo(min);
  const hours = Math.round(min / 60);
  if (hours < 24) return t.relHrAgo(hours);
  const days = Math.round(hours / 24);
  return t.relDayAgo(days);
}
