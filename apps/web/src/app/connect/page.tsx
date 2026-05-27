import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getLastSyncStatus, getLibrarySummary } from "@/lib/connection";
import { requireOnboarded } from "@/lib/onboarding";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
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
  const [{ count, recent }, lastSync] = await Promise.all([
    getLibrarySummary(userId),
    getLastSyncStatus(userId),
  ]);

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
 * extension sync. Sync is append-only now, so there's no
 * complete/partial/append-only branching to display — every successful
 * sync just adds. When the captured count came in short of the playlist
 * header it's surfaced as a hint to re-run, but never as a warning,
 * because nothing got destroyed either way.
 */
function LastSyncBadge({
  status,
  locale,
}: {
  status: import("@/lib/connection").LastSyncStatus;
  locale: Locale;
}) {
  const ago = formatRelative(status.at, locale);
  const captured = status.captured ?? 0;
  const expected = status.expected;
  const short =
    expected != null && captured < Math.floor(expected * 0.99);
  const headerHint = short
    ? locale === "ko"
      ? ` · 페이지 헤더는 ${expected!.toLocaleString()}곡 표시 (다시 동기화하면 누락분 추가)`
      : ` · header showed ${expected!.toLocaleString()} (re-sync to pick up the rest)`
    : "";
  return (
    <p className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200">
      {locale === "ko"
        ? `✓ 마지막 동기화 — ${captured.toLocaleString()}곡 전송됨${headerHint} · ${ago}`
        : `✓ Last sync — ${captured.toLocaleString()} songs sent${headerHint} · ${ago}`}
    </p>
  );
}

/** "12 minutes ago" / "12분 전" — coarse, no need for a date library. */
function formatRelative(iso: string, locale: Locale): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return locale === "ko" ? "방금" : "just now";
  if (min < 60) return locale === "ko" ? `${min}분 전` : `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return locale === "ko" ? `${hours}시간 전` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return locale === "ko" ? `${days}일 전` : `${days}d ago`;
}
