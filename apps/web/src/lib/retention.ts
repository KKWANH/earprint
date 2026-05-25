/**
 * Periodic data-retention housekeeping. Driven from /api/cron/tick via
 * runRetentionIfDue() — that helper guards against running more than once
 * per 24h regardless of how often the per-minute tick fires.
 *
 * Retention policy (documented in /privacy):
 *   • api_usage  rows older than 90 days     → delete (debug telemetry only)
 *   • user_usage rows older than 90 days     → delete (per-user counters)
 *   • background_jobs done/failed > 30 days  → delete (history not needed)
 *   • Inactive accounts (no last_seen > 3y)  → hard delete the user row
 *     which cascades through every user-scoped table.
 *
 * Hard inactivity deletion is deliberately conservative — three full years
 * is well past any reasonable abandonment window and gives plenty of room
 * to add a "we're about to delete you" warning email later.
 */
import { getSql } from "./db";

export interface RetentionSummary {
  apiUsageDeleted: number;
  userUsageDeleted: number;
  jobsDeleted: number;
  inactiveAccountsDeleted: number;
}

const INACTIVE_ACCOUNT_DAYS = 365 * 3; // 3 years
const USAGE_RETENTION_DAYS = 90;
const JOB_RETENTION_DAYS = 30;

export async function runRetention(): Promise<RetentionSummary> {
  const sql = getSql();
  const [u1, u2, j, ia] = await Promise.all([
    sql`
      DELETE FROM api_usage
       WHERE usage_date < (CURRENT_DATE - ${USAGE_RETENTION_DAYS}::int)
       RETURNING 1` as Promise<unknown[]>,
    sql`
      DELETE FROM user_usage
       WHERE usage_date < (CURRENT_DATE - ${USAGE_RETENTION_DAYS}::int)
       RETURNING 1` as Promise<unknown[]>,
    sql`
      DELETE FROM background_jobs
       WHERE status IN ('done', 'failed')
         AND updated_at < (now() - (${JOB_RETENTION_DAYS}::int * INTERVAL '1 day'))
       RETURNING 1` as Promise<unknown[]>,
    sql`
      DELETE FROM users
       WHERE last_seen_at < (now() - (${INACTIVE_ACCOUNT_DAYS}::int * INTERVAL '1 day'))
       RETURNING 1` as Promise<unknown[]>,
  ]);
  return {
    apiUsageDeleted: u1.length,
    userUsageDeleted: u2.length,
    jobsDeleted: j.length,
    inactiveAccountsDeleted: ia.length,
  };
}

/**
 * Runs retention at most once per 24h. The cron_state row uses
 * INSERT…ON CONFLICT…WHERE so it's atomic against concurrent tick races.
 * Returns null when not yet due, otherwise the summary.
 */
export async function runRetentionIfDue(): Promise<RetentionSummary | null> {
  const sql = getSql();
  // Try to acquire the daily slot. ON CONFLICT updates only when the existing
  // row is old enough — Postgres' WHERE clause on DO UPDATE acts as a
  // distributed lock without needing a separate flag.
  const claimed = await sql`
    INSERT INTO cron_state (task, last_run)
    VALUES ('retention', now())
    ON CONFLICT (task) DO UPDATE
       SET last_run = now()
     WHERE cron_state.last_run < (now() - INTERVAL '24 hours')
    RETURNING task`;
  if (claimed.length === 0) return null; // someone else (or the clock) said "not yet"
  return runRetention();
}
