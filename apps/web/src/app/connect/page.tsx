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
 * extension sync. Three shapes correspond to the three real outcomes the
 * server distinguishes today (see /api/sync):
 *
 *   • complete     — extension reached the bottom of the liked list and
 *                    matched the playlist header. Library was authorised
 *                    to drop missing tracks; `removed` says how many.
 *   • partial      — capture count came in short of the page header.
 *                    Library was NOT replaced — append-only this round.
 *                    Surfaced as a warning so the user re-runs sync.
 *   • append-only  — extension didn't assert completeness (older build,
 *                    or interrupted scrape). No deletes. Soft notice.
 */
function LastSyncBadge({
  status,
  locale,
}: {
  status: import("@/lib/connection").LastSyncStatus;
  locale: Locale;
}) {
  const ago = formatRelative(status.at, locale);
  const isPartial =
    status.complete === false &&
    status.expected != null &&
    status.captured != null &&
    status.captured < status.expected;

  if (status.complete === true) {
    const removed = status.removed ?? 0;
    const removedStr =
      removed > 0
        ? locale === "ko"
          ? ` · ${removed.toLocaleString()}곡 정리됨`
          : ` · ${removed.toLocaleString()} removed`
        : "";
    return (
      <p className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200">
        {locale === "ko"
          ? `✓ 완전 동기화 — ${(status.captured ?? 0).toLocaleString()}곡${removedStr} · ${ago}`
          : `✓ Complete sync — ${(status.captured ?? 0).toLocaleString()} songs${removedStr} · ${ago}`}
      </p>
    );
  }
  if (isPartial) {
    return (
      <p className="rounded-md border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200">
        {locale === "ko"
          ? `⚠ 부분 동기화 — ${(status.captured ?? 0).toLocaleString()} / ${(status.expected ?? 0).toLocaleString()} · 라이브러리는 교체되지 않았습니다. 다시 동기화하세요 · ${ago}`
          : `⚠ Partial sync — ${(status.captured ?? 0).toLocaleString()} of ${(status.expected ?? 0).toLocaleString()}. Library was NOT replaced. Run sync again · ${ago}`}
      </p>
    );
  }
  return (
    <p className="rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-300">
      {locale === "ko"
        ? `최근 동기화: ${(status.captured ?? 0).toLocaleString()}곡 (추가 전용) · ${ago}`
        : `Last sync: ${(status.captured ?? 0).toLocaleString()} songs (append-only) · ${ago}`}
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
