import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { PAYMENTS_ENABLED } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { accountDict } from "@/lib/i18n/account";
import { getPlanState } from "@/lib/plan";
import { AiConsentToggle } from "./AiConsentToggle";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { DisconnectYtButton } from "./DisconnectYtButton";
import { RotateSyncTokenButton } from "./RotateSyncTokenButton";
import { WorldcupHistorySection } from "./WorldcupHistorySection";

export async function generateMetadata(): Promise<Metadata> {
  const t = accountDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

interface AccountRow {
  display_name: string | null;
  created_at: string;
  yt_access_token: string | null;
  yt_token_expires_at: string | null;
  synced_count: number;
  last_synced_at: string | null;
}

async function loadAccount(userId: string): Promise<AccountRow> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.display_name,
           u.created_at,
           u.yt_access_token,
           u.yt_token_expires_at,
           (SELECT count(*)::int FROM user_tracks ut WHERE ut.user_id = u.id) AS synced_count,
           (SELECT max(ut.captured_at) FROM user_tracks ut WHERE ut.user_id = u.id) AS last_synced_at
    FROM users u WHERE u.id = ${userId}`;
  const r = rows[0];
  return {
    display_name: (r?.display_name as string) ?? null,
    created_at: r?.created_at as string,
    yt_access_token: (r?.yt_access_token as string) ?? null,
    yt_token_expires_at: (r?.yt_token_expires_at as string) ?? null,
    synced_count: (r?.synced_count as number) ?? 0,
    last_synced_at: (r?.last_synced_at as string) ?? null,
  };
}

/**
 * Account management — the page users land on from the navbar avatar.
 * Surfaces every privacy-relevant control in one place so users (and Google
 * verification reviewers) can see how to disconnect / delete their data.
 */
export default async function AccountPage() {
  const locale = await getLocale();
  const t = accountDict(locale);
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/account" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.loginGoogle}
          </button>
        </form>
      </main>
    );
  }

  const conn = await ensureConnection();
  const userId = conn.userId;
  const data = await loadAccount(userId);
  const ytConnected = !!data.yt_access_token;
  const planState = await getPlanState(userId);
  const aiConsent = conn.aiConsent;
  const lang = locale === "ko" ? "ko-KR" : "en-US";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="truncate text-xs text-neutral-500">{session.user.email}</p>
      </header>

      <Section title={t.profileTitle}>
        <Row label={t.email} value={session.user.email ?? t.unknown} />
        <Row label={t.displayName} value={data.display_name ?? t.unknown} />
        <Row
          label={t.memberSince}
          value={
            data.created_at
              ? new Date(data.created_at).toLocaleDateString(lang)
              : t.unknown
          }
        />
      </Section>

      {PAYMENTS_ENABLED && (
        <section
          className={`flex flex-col gap-3 rounded-xl border p-6 ${
            planState.isPro
              ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900"
              : "border-neutral-800 bg-neutral-900"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{t.planTitle}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                planState.isPro
                  ? "bg-emerald-500 text-black"
                  : "bg-white/10 text-neutral-300"
              }`}
            >
              {planState.isPro ? t.planPro : t.planFree}
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            {planState.isPro ? t.planProDesc : t.planFreeDesc}
          </p>
          {planState.isPro && planState.planUntil && (
            <p className="text-xs text-neutral-500">
              {t.planUntil(planState.planUntil.toLocaleDateString(lang))}
            </p>
          )}
          {!planState.isPro && (
            <p className="text-xs text-neutral-400">
              {t.creditsRemaining(planState.credits)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {planState.isPro ? (
              <a
                href="/api/lemon/portal"
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                {t.managePlanButton}
              </a>
            ) : (
              <Link
                href="/pricing"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                {t.upgradeButton}
              </Link>
            )}
          </div>
        </section>
      )}

      <Section title={t.librarySummaryTitle}>
        <p className="text-sm text-neutral-300">
          {data.synced_count > 0
            ? t.syncedTracks(data.synced_count)
            : t.neverSynced}
        </p>
        {data.last_synced_at && (
          <p className="text-xs text-neutral-500">
            {t.lastSyncedAt}:{" "}
            {new Date(data.last_synced_at).toLocaleString(lang)}
          </p>
        )}
        <Link
          href="/library"
          className="self-start text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
        >
          {t.openLibrary}
        </Link>
      </Section>

      <WorldcupHistorySection userId={userId} locale={locale} />

      <Section title={t.connectionsTitle}>
        <div className="flex flex-col gap-2">
          <ConnectionRow
            label={t.connectionGoogle}
            desc={t.connectionGoogleDesc}
            statusGood
            statusText="✓"
          />
          <ConnectionRow
            label={t.connectionYt}
            desc={
              ytConnected ? t.connectionYtConnected : t.connectionYtNotConnected
            }
            statusGood={ytConnected}
            statusText={ytConnected ? "✓" : "—"}
          />
          {ytConnected ? (
            <DisconnectYtButton locale={locale} />
          ) : (
            <Link
              href="/api/yt-oauth/start"
              className="self-start rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              {t.connectYtButton}
            </Link>
          )}
          <p className="text-[11px] text-neutral-600">
            {t.revokeNote}{" "}
            <a
              href={t.revokeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neutral-400"
            >
              myaccount.google.com/permissions
            </a>
          </p>
        </div>
      </Section>

      <Section title={t.syncTokenTitle}>
        <p className="text-sm text-neutral-400">{t.syncTokenDesc}</p>
        <RotateSyncTokenButton locale={locale} />
      </Section>

      <Section title={t.aiConsentTitle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-200">
              {t.aiConsentLabel}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              {t.aiConsentDesc}
            </p>
          </div>
          <AiConsentToggle initialGranted={aiConsent} locale={locale} />
        </div>
      </Section>

      <Section title={t.exportTitle}>
        <p className="text-sm text-neutral-400">{t.exportDesc}</p>
        <a
          href="/api/dsar/export"
          download
          className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
        >
          {t.exportButton}
        </a>
      </Section>

      <Section title={t.signOutTitle}>
        <p className="text-sm text-neutral-400">{t.signOutDesc}</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white">
            {t.signOut}
          </button>
        </form>
      </Section>

      <section className="flex flex-col gap-3 rounded-xl border border-rose-900/40 bg-neutral-900 p-6">
        <h2 className="font-semibold text-rose-300">{t.dangerTitle}</h2>
        <p className="text-sm text-neutral-400">{t.dangerDesc}</p>
        <DeleteAccountButton locale={locale} />
      </section>

      <nav className="mt-2 flex justify-center gap-4 text-xs text-neutral-600">
        <Link href="/privacy" className="hover:text-neutral-300">
          {t.privacy}
        </Link>
        <Link href="/terms" className="hover:text-neutral-300">
          {t.terms}
        </Link>
      </nav>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/5 py-1.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <span className="truncate text-sm text-neutral-200">{value}</span>
    </div>
  );
}

function ConnectionRow({
  label,
  desc,
  statusGood,
  statusText,
}: {
  label: string;
  desc: string;
  statusGood: boolean;
  statusText: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-neutral-400">{desc}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
          statusGood
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-white/5 text-neutral-500"
        }`}
      >
        {statusText}
      </span>
    </div>
  );
}
