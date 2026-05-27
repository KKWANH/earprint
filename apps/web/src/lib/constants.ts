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
 * Once flipped, the gates honour the user's `plan` column.
 */
export const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";

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
