import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import {
  PAYMENTS_ENABLED,
  SPOTIFY_ENABLED,
  PAYMENT_DOWNGRADE_NOTICE,
  isAdminEmail,
} from "@/lib/constants";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { accountDict } from "@/lib/i18n/account";
import { getPlanState } from "@/lib/plan";
import { AiConsentToggle } from "./AiConsentToggle";
import { ConnectionsBoard } from "./ConnectionsBoard";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { RotateSyncTokenButton } from "./RotateSyncTokenButton";
import { WorldcupHistorySection } from "./WorldcupHistorySection";

export async function generateMetadata(): Promise<Metadata> {
  const t = accountDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

interface AccountRow {
  display_name: string | null;
  created_at: string;
  synced_count: number;
  last_synced_at: string | null;
}

async function loadAccount(userId: string): Promise<AccountRow> {
  const sql = getSql();
  // yt_access_token / yt_refresh_token / yt_token_expires_at columns
  // still exist in the schema for backward compat (older rows still
  // carry tokens from when the Data API path was live) but we no
  // longer read or use them — the YouTube Data API sync was removed.
  const rows = await sql`
    SELECT u.display_name,
           u.created_at,
           (SELECT count(*)::int FROM user_tracks ut WHERE ut.user_id = u.id) AS synced_count,
           (SELECT max(ut.captured_at) FROM user_tracks ut WHERE ut.user_id = u.id) AS last_synced_at
    FROM users u WHERE u.id = ${userId}`;
  const r = rows[0];
  return {
    display_name: (r?.display_name as string) ?? null,
    created_at: r?.created_at as string,
    synced_count: (r?.synced_count as number) ?? 0,
    last_synced_at: (r?.last_synced_at as string) ?? null,
  };
}

/**
 * Account management — the page users land on from the navbar avatar.
 * Surfaces every privacy-relevant control in one place so users (and Google
 * verification reviewers) can see how to disconnect / delete their data.
 */
export default async function AccountPage({
  searchParams,
}: {
  // R35 — `?previewAs=free` admin-only switch that renders the
  // page as if the user were on the free tier, even if they're
  // allowlisted or PAYMENTS_ENABLED is off. Used to preview what
  // a regular user sees before turning payments on.
  searchParams: Promise<{ previewAs?: string }>;
}) {
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
  // R35 — honor preview only when the caller is allowlisted, so a
  // crafted URL can't bypass entitlement on someone else's account.
  const sp = await searchParams;
  const previewAsFree =
    sp.previewAs === "free" && isAdminEmail(session.user.email ?? "");
  const planState = await getPlanState(userId, { previewAsFree });
  const aiConsent = conn.aiConsent;
  const lang = locale === "ko" ? "ko-KR" : "en-US";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="truncate text-xs text-neutral-500">{session.user.email}</p>
      </header>

      {/* R32g — operator-set notice banner. Used to pre-warn users
          about a payment-mode flip ("free → free-tier limits" coming
          on date X). Empty string / unset → no banner. */}
      {PAYMENT_DOWNGRADE_NOTICE && (
        <div className="rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs leading-relaxed text-amber-100">
          ⚠ {PAYMENT_DOWNGRADE_NOTICE}
        </div>
      )}

      {/* R35 — admin-only Plan preview toggle. Renders only for
          allowlisted operators; lets them see what the page looks
          like in 'free' mode without flipping PAYMENTS_ENABLED for
          everyone. The actual entitlement isn't changed — pure
          render-time projection via getPlanState's previewAsFree
          flag. */}
      {isAdminEmail(session.user.email) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-violet-500/40 bg-violet-950/30 px-4 py-2 text-xs text-violet-100">
          <span>
            🧪 {t.adminPreviewLabel}{" "}
            <strong>
              {previewAsFree
                ? t.adminPreviewFreeMode
                : t.adminPreviewActualState}
            </strong>
          </span>
          {previewAsFree ? (
            <Link
              href="/account"
              className="rounded-md border border-violet-500/40 px-2 py-0.5 text-[11px] text-violet-100 hover:bg-violet-900/40"
            >
              {t.adminPreviewBackToActual}
            </Link>
          ) : (
            <Link
              href="/account?previewAs=free"
              className="rounded-md border border-violet-500/40 px-2 py-0.5 text-[11px] text-violet-100 hover:bg-violet-900/40"
            >
              {t.adminPreviewAsFree}
            </Link>
          )}
        </div>
      )}

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

      {/* Plan + service status panel (R31b). Always visible now —
          previously gated on PAYMENTS_ENABLED so beta users didn't
          see any plan state at all. We now surface 'Open Beta — all
          Pro' when payments are off so users have visibility into
          their entitlement; allowlisted operators see 'Lifetime'. */}
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
            {planState.isLifetime
              ? t.planLifetime
              : !PAYMENTS_ENABLED && planState.isPro
                ? t.planOpenBetaPro
                : planState.isPro
                  ? t.planPro
                  : t.planFree}
          </span>
        </div>
        <p className="text-sm text-neutral-400">
          {!PAYMENTS_ENABLED && planState.isPro && !planState.isLifetime
            ? t.planOpenBetaDesc
            : planState.isLifetime
              ? t.planLifetimeDesc
              : planState.isPro
                ? t.planProDesc
                : t.planFreeDesc}
        </p>
        {planState.isPro && planState.planUntil && (
          <p className="text-xs text-neutral-500">
            {t.planUntil(planState.planUntil.toLocaleDateString(lang))}
          </p>
        )}
        {PAYMENTS_ENABLED && !planState.isPro && (
          <p className="text-xs text-neutral-400">
            {t.creditsRemaining(planState.credits)}
          </p>
        )}
        {PAYMENTS_ENABLED && (
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
        )}
      </section>

      {/* R34 — unified Connections board: Google / extension /
          Spotify in one consistent layout. Replaces the previous
          Service-status row + the separate Google ConnectionRow
          + the separate Library "open" link, since users were
          having to scan three different surfaces to understand
          their connection state. Payments status moved out to
          its own tiny row below since it's not really a
          "connection" in the same sense. */}
      <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t.connectionsHeading}
        </h2>
        <ConnectionsBoard
          ko={locale === "ko"}
          googleEmail={session.user.email ?? ""}
          extensionSyncedCount={data.synced_count ?? 0}
          extensionLastSyncedAt={data.last_synced_at ?? null}
          spotifyFeatureEnabled={SPOTIFY_ENABLED}
        />
      </section>
      {/* Tiny payments-mode chip — operators want quick visibility
          but it's not a "connection" per the new board's semantics. */}
      <p className="flex items-center gap-2 text-[11px] text-neutral-500">
        <span>{t.paymentsLabel}</span>
        {PAYMENTS_ENABLED ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">
            {t.paymentsEnabled}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">
            {t.paymentsOpenBeta}
          </span>
        )}
      </p>

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
          <p className="text-[11px] leading-relaxed text-neutral-600">
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

      {/* DSAR / GDPR Article 15+20 data portability. R31d boosted
          this from the previous muted-border treatment into an
          emerald-bordered panel — privacy-conscious users see it
          as a feature, not buried "settings" plumbing. The download
          link doubles as a button with file-icon hint. */}
      <section className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-emerald-200">{t.exportTitle}</h2>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            GDPR Art. 15+20
          </span>
        </div>
        <p className="text-sm leading-relaxed text-neutral-300">
          {t.exportDesc}
        </p>
        <p className="text-xs leading-relaxed text-neutral-500">
          {t.exportContentsNote}
        </p>
        <a
          href="/api/dsar/export"
          download
          className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          📥 {t.exportButton}
        </a>
      </section>

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
