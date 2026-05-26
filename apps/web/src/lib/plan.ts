import { getSql } from "@/lib/db";
import { PAYMENTS_ENABLED, FREE_LIMITS } from "@/lib/constants";

/**
 * Effective plan for a user. When PAYMENTS_ENABLED is off everyone is
 * treated as Pro — gates only matter once the paywall is live.
 *
 * The stored `plan` column is the source of truth; for monthly subs we also
 * check `plan_until` so an expired sub falls back to free without needing a
 * webhook to write 'free' (defensive).
 */
export type Plan = "free" | "pro";

export interface PlanState {
  plan: Plan;
  isLifetime: boolean;
  planUntil: Date | null;
  /** Per-analysis credits remaining (ignored when user is Pro / payments off). */
  credits: number;
  /** True if the user is currently entitled to Pro features. */
  isPro: boolean;
}

export async function getPlanState(userId: string): Promise<PlanState> {
  const sql = getSql();
  const rows = await sql`
    SELECT plan, plan_until, is_lifetime, credits
    FROM users WHERE id = ${userId}`;
  const r = rows[0] as
    | {
        plan: Plan;
        plan_until: string | null;
        is_lifetime: boolean;
        credits: number;
      }
    | undefined;

  const plan: Plan = r?.plan ?? "free";
  const isLifetime = !!r?.is_lifetime; // legacy column; kept for compatibility
  const planUntil = r?.plan_until ? new Date(r.plan_until) : null;
  const credits = r?.credits ?? 0;

  // Master switch off → everyone is Pro. Avoids accidental gating while
  // payments are still in dry-run.
  if (!PAYMENTS_ENABLED) {
    return {
      plan: "pro",
      isLifetime: false,
      planUntil: null,
      credits: Infinity,
      isPro: true,
    };
  }

  const subActive =
    plan === "pro" && (isLifetime || (planUntil != null && planUntil > new Date()));

  return {
    plan,
    isLifetime,
    planUntil,
    credits,
    isPro: subActive,
  };
}

/**
 * Atomic credit spend. Returns true when the credit was successfully
 * consumed, false when the user has none (and isn't Pro). Pro users +
 * payments-off bypass via the credit guard below — they don't decrement.
 *
 * Uses `RETURNING` after a conditional UPDATE so the check is single-row
 * atomic against concurrent requests.
 */
export async function spendCredit(userId: string): Promise<boolean> {
  if (!PAYMENTS_ENABLED) return true;
  if (await isPro(userId)) return true;
  const sql = getSql();
  const rows = await sql`
    UPDATE users
       SET credits = credits - 1,
           updated_at = now()
     WHERE id = ${userId} AND credits > 0
     RETURNING credits`;
  return rows.length > 0;
}

/** Convenience: just the boolean. */
export async function isPro(userId: string): Promise<boolean> {
  return (await getPlanState(userId)).isPro;
}

/**
 * Atomically increment a per-user daily counter and return the new total.
 * Use with checkAndConsume() to apply a free-tier cap.
 */
async function bumpUsage(userId: string, kind: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO user_usage (user_id, kind, usage_date, count)
    VALUES (${userId}, ${kind}, CURRENT_DATE, 1)
    ON CONFLICT (user_id, kind, usage_date)
    DO UPDATE SET count = user_usage.count + 1
    RETURNING count`;
  return rows[0].count as number;
}

/**
 * Try to "spend" one unit of `kind` against the free-tier daily cap. Returns
 * `{ allowed: true }` when within budget OR when the user is Pro OR when the
 * master switch is off. Otherwise returns the limit so the UI can explain.
 */
export async function checkAndConsumeFreeQuota(
  userId: string,
  kind: keyof typeof FREE_LIMITS extends never ? never : "aiProfilePerDay",
): Promise<{ allowed: true } | { allowed: false; limit: number; used: number }> {
  if (!PAYMENTS_ENABLED) return { allowed: true };
  if (await isPro(userId)) return { allowed: true };

  const limit = FREE_LIMITS[kind];
  const count = await bumpUsage(userId, kind);
  if (count > limit) {
    return { allowed: false, limit, used: count };
  }
  return { allowed: true };
}
