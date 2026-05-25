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
export const CURRENT_TOS_VERSION = "2026-05-25";

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

/** Pricing displayed on the /pricing page and the upgrade card. */
export const PLAN_PRICES = {
  monthly: { amount: 3, currency: "USD", label: "$3 / month" },
  lifetime: { amount: 25, currency: "USD", label: "$25 once" },
} as const;
