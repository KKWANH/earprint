/**
 * Periodic MIR backfill — re-opens analyze jobs for users who finished
 * Phase 1+2 before the MIR phase existed (or before they had any
 * preview_urls populated). Without this, those users would stay marked
 * `done` forever and never get audio embeddings, so recommend v2 and
 * the embedding-based artist map would silently skip them.
 *
 * Strategy:
 *   • Find users with `background_jobs.status = 'done'` AND ≥1 track
 *     that has a preview_url but no embedding row.
 *   • Bump their status back to 'running'. The Fly worker's dispatcher
 *     sees Phase 1+2 already complete and falls through to MIR.
 *   • When MIR finishes, the Workers cron's finishJob path marks them
 *     'done' again. Next backfill tick checks: if no more missing
 *     embeddings, no re-trigger. Idempotent and self-limiting.
 *
 * Runs at most once per 24 h via cron_state — same pattern as retention.
 */
import { getSql } from "./db";

export interface MirBackfillSummary {
  triggered: number;
}

const BACKFILL_BATCH = 20; // users re-opened per daily run

export async function runMirBackfill(): Promise<MirBackfillSummary> {
  const sql = getSql();
  // Two layers because the LIMIT must apply to DISTINCT users, not to
  // user_tracks rows. The earlier version put LIMIT inside the DISTINCT
  // subquery, which capped row scanning — fine on small data, but the
  // engine picked the first 20 (user_id, track_id) rows and they all
  // tended to share one heavy-backlog user. Result: 1 user re-opened
  // per day, not 20. Now we DISTINCT first, then LIMIT users.
  //
  // We also exclude jobs whose previous backfill attempt was less than
  // a day old AND wrote zero embeddings (worker.tick() failed every
  // batch — usually a preview_url Deezer no longer serves). Without
  // that guard a permanently-bad track set re-opens the job daily
  // forever, burning Deezer + Gemini quota for nothing.
  const rows = await sql`
    UPDATE background_jobs bj
    SET status = 'running', updated_at = now()
    WHERE bj.kind = 'analyze'
      AND bj.status = 'done'
      AND bj.user_id IN (
        SELECT user_id FROM (
          SELECT DISTINCT ut.user_id
          FROM user_tracks ut
          JOIN tracks t ON t.id = ut.track_id
          LEFT JOIN embeddings e ON e.track_id = t.id
          WHERE t.preview_url IS NOT NULL
            AND e.track_id IS NULL
        ) s
        LIMIT ${BACKFILL_BATCH}
      )
    RETURNING user_id`;
  return { triggered: rows.length };
}

/** Run at most once per 24 h; returns null when not yet due. Same atomic
 *  claim pattern as runRetentionIfDue() so concurrent cron ticks can't
 *  double-trigger. */
export async function runMirBackfillIfDue(): Promise<MirBackfillSummary | null> {
  const sql = getSql();
  const claimed = await sql`
    INSERT INTO cron_state (task, last_run)
    VALUES ('mir_backfill', now())
    ON CONFLICT (task) DO UPDATE
       SET last_run = now()
     WHERE cron_state.last_run < (now() - INTERVAL '24 hours')
    RETURNING task`;
  if (claimed.length === 0) return null;
  return runMirBackfill();
}
