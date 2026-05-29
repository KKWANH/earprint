/**
 * Site-wide constants. The Chrome Web Store URL is referenced from multiple
 * pages, so it lives here instead of being duplicated across copy.
 */

/** Public Chrome Web Store listing for the Earprint extension. */
export const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/nfhgnpjhiencoajdfdadegnfbbhfjjkj";

/**
 * Current Terms / Privacy document version. Bump this string whenever the
 * legal docs change in a way that requires re-consent — the onboarding
 * middleware re-prompts users whose stored tos_version doesn't match.
 */
export const CURRENT_TOS_VERSION = "2026-05-28";

/**
 * Minimum age for unaided sign-up in our biggest regulated market (EU,
 * GDPR Article 8). 16 is the EU baseline; member states may lower it
 * (Belgium = 13, Spain = 14), we use the strictest baseline for safety.
 */
export const MIN_AGE = 16;

/**
 * Master kill-switch for everything paywall-related. Defaults OFF — the
 * /pricing page and all gates stay invisible until the env flag flips ON.
 * Once flipped, the gates honour the user's `plan` column. Allowlisted
 * emails (PRO_ALLOWLIST_EMAILS) stay free Pro even after this flips.
 *
 * Toggle: wrangler secret put PAYMENTS_ENABLED (input "true" / "false").
 */
export const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";

/**
 * Operator-controlled banner shown above /library and /account when
 * we're about to flip PAYMENTS_ENABLED on. Set via:
 *   wrangler secret put PAYMENT_DOWNGRADE_NOTICE
 * with the literal banner text (e.g. "2026-06-15부터 결제 모드로
 * 전환됩니다. 평소 사용량이 무료 한도를 넘으면 Pro 구독을 고려해
 * 주세요."). Unset → no banner. R32g.
 */
export const PAYMENT_DOWNGRADE_NOTICE =
  process.env.PAYMENT_DOWNGRADE_NOTICE?.trim() || null;

/**
 * Master kill-switch for the Spotify integration. Defaults ON so the
 * existing feature stays available; flip OFF while waiting for the
 * Spotify Premium subscription / Extended Quota Mode approval to
 * unblock the /me 403. When OFF:
 *   - /api/auth/spotify/start returns 503
 *   - /api/spotify/* return 503
 *   - SpotifyConnectCard renders a "준비 중" disabled state with a
 *     hint about why
 *   - /account shows "Spotify (비활성)" instead of "connected"
 *
 * Toggle: wrangler secret put SPOTIFY_ENABLED (input "true" / "false").
 */
// Default OFF (R32c) — until the operator subscribes to Spotify
// Premium and explicitly sets SPOTIFY_ENABLED=true. Without the env
// var the integration stays disabled in prod, surfacing the soft
// "Coming soon" UX everywhere. Flip to "true" via
//   wrangler secret put SPOTIFY_ENABLED
// once Premium has propagated through Spotify's systems (~hours
// after subscription).
export const SPOTIFY_ENABLED =
  (process.env.SPOTIFY_ENABLED ?? "false").toLowerCase() === "true";

/**
 * Emails that always get Pro entitlement, regardless of PAYMENTS_ENABLED
 * or the user's stored `plan` column. Used for operator accounts +
 * any pre-paid early supporters we want to comp without going through
 * the Lemon Squeezy flow. Entries MUST be lowercased — the runtime
 * comparison normalises the incoming email but doesn't normalise this
 * constant, so a "Foo@Bar.com" entry would silently never match.
 */
export const PRO_ALLOWLIST_EMAILS = [
  "kwanho0096@gmail.com",
  "sspkr1782@gmail.com",
] as const;
for (const e of PRO_ALLOWLIST_EMAILS) {
  if (e !== e.toLowerCase()) {
    throw new Error(`PRO_ALLOWLIST_EMAILS must be lowercased: "${e}"`);
  }
}

/** Predicate matching the lowercased email. */
export function isProAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  return (PRO_ALLOWLIST_EMAILS as readonly string[]).includes(
    email.toLowerCase(),
  );
}

/** Free-tier daily caps. Applied only when PAYMENTS_ENABLED is true. */
export const FREE_LIMITS = {
  /** Max AI profile generations per day. */
  aiProfilePerDay: 1,
  /** Max library size (synced tracks) accepted by /api/sync. */
  librarySize: 500,
  /** Max custom share themes (free = none, pro = all). */
  shareThemes: 0,
} as const;

/**
 * Pricing for the /pricing page and the upgrade card.
 *
 * Multi-currency display (single SKU, settled in USD by Lemon Squeezy).
 * KR users see ₩2,500 — small enough for impulse purchase, large enough
 * that the Lemon Squeezy fee ($0.50 + 5%) leaves a healthy margin over
 * the per-analysis Gemini cost (~$0.014).
 *
 * Margin math at ₩2,500 single (≈ $1.85):
 *   Lemon fee:   $0.50 + 5%   = ~$0.59
 *   Gemini cost: ~$0.014
 *   Net per sale: ~$1.25
 *
 * Monthly subscription paused — re-introduce once the analysis-history
 * feature lands so "why pay again next month" has a real answer.
 */
export const PLAN_PRICES = {
  /** Single one-off analysis credit. Display currency follows locale;
   *  Lemon Squeezy still settles in USD. Subject to ±1% display rounding
   *  at the regional payment surface. */
  analysis: {
    KRW: { amount: 2500, label: "₩2,500" },
    USD: { amount: 1.99, label: "$1.99" },
    EUR: { amount: 1.99, label: "€1.99" },
  },
  /** Three-pack — bundle of 3 analyses for ~33% off vs. buying singles.
   *  Per-analysis cost: ₩1,667 / $1.33 / €1.33. The discount nudges
   *  users toward a bigger one-time spend (better margin given the
   *  Lemon Squeezy flat-fee component) while staying clearly cheap. */
  triple: {
    KRW: { amount: 5000, label: "₩5,000" },
    USD: { amount: 3.99, label: "$3.99" },
    EUR: { amount: 3.99, label: "€3.99" },
  },
} as const;

/** Number of credits granted per SKU purchase. Read by the Lemon
 *  webhook to credit the user's account. */
export const PLAN_CREDITS = {
  analysis: 1,
  triple: 3,
} as const;

/** Pick the display variant for the current locale. KR → KRW, default
 *  KR-EN to USD; everything else USD too. EUR is exposed for the
 *  payment surface but not auto-defaulted from locale (Europe users
 *  often have USD cards anyway and Lemon Squeezy will let them switch). */
export function priceForLocale(
  locale: "ko" | "en",
): (typeof PLAN_PRICES.analysis)[keyof typeof PLAN_PRICES.analysis] {
  return locale === "ko" ? PLAN_PRICES.analysis.KRW : PLAN_PRICES.analysis.USD;
}

/** Same as priceForLocale() but for the 3-pack SKU. */
export function triplePriceForLocale(
  locale: "ko" | "en",
): (typeof PLAN_PRICES.triple)[keyof typeof PLAN_PRICES.triple] {
  return locale === "ko" ? PLAN_PRICES.triple.KRW : PLAN_PRICES.triple.USD;
}

/** Email allowlist for `/admin` and any operator-only API. Keep this
 *  short — these accounts can change tuning knobs that affect every
 *  user's results. Entries MUST be lowercased — the match in
 *  isAdminEmail() normalises the incoming value but doesn't normalise
 *  the constant. A pre-flight assertion below catches a typo at module
 *  load instead of when someone tries to admin-sign-in months later. */
export const ADMIN_EMAILS = ["kwanho0096@gmail.com"] as const;

// Assert each entry is already lowercase so a future PR can't silently
// break admin auth by adding "Operator@Example.com" to the list.
for (const e of ADMIN_EMAILS) {
  if (e !== e.toLowerCase()) {
    throw new Error(`ADMIN_EMAILS must be lowercase: "${e}"`);
  }
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase());
}
