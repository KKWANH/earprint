import { getSql } from "./db";
import { enrichTrack } from "./enrich";
import { aiAnalyzeBatch } from "./aiAnalyze";
import { buildCompletionEmail, sendEmail } from "./email";
import { getLibraryStats } from "./library";
import { isWhitelisted } from "./usage";

export type JobStatus = "running" | "stopped" | "done" | "idle";
export type Phase = "enrich" | "ai" | "done";

// Cloudflare Workers (free plan) caps a single request at 50 outbound
// subrequests. Each enrichTrack can fire up to 4 (cache SELECT + advanced
// search + fallback search + track detail + cache INSERT), so we keep the
// batch comfortably under: 8 × 4 = 32, plus ~7 housekeeping SQL → ~39.
// Bumping past 10 here will start tripping HTTP 500s on uncached tracks.
const ENRICH_BATCH = 8;
// AI batch is NOT bound by the subrequest cap — one Gemini call covers the
// whole batch, regardless of size. Bigger batch = fewer round-trips =
// shorter total wallclock. 30 tracks gives ~3,000 output tokens, well
// within the model's 8K cap, and Gemini's quality holds at this size.
const AI_BATCH = 30;

/** Phase 1 — Deezer + Last.fm enrichment. Returns tracks processed. */
export async function runEnrichBatch(userId: string): Promise<number> {
  const sql = getSql();
  const batch = await sql`
    SELECT t.id, t.title, t.artist
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId} AND a.id IS NULL
    LIMIT ${ENRICH_BATCH}`;
  if (batch.length > 0) {
    const rows = await Promise.all(
      batch.map(async (t) => ({
        trackId: t.id as string,
        ...(await enrichTrack(t.artist as string, t.title as string)),
      })),
    );
    await sql`SELECT save_enrichments(${JSON.stringify(rows)}::jsonb)`;
  }
  return batch.length;
}

/** Phase 2 — Gemini refines genres/moods and estimates audio feel for every track. */
export async function runAiAnalysisBatch(userId: string): Promise<number> {
  const sql = getSql();
  const batch = await sql`
    SELECT t.id, t.title, t.artist
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    JOIN tracks t ON t.id = a.track_id
    WHERE ut.user_id = ${userId} AND a.analysis_version = 1 AND a.audio_feel IS NULL
    LIMIT ${AI_BATCH}`;
  if (batch.length > 0) {
    const rows = await aiAnalyzeBatch(
      batch.map((t) => ({
        id: t.id as string,
        artist: t.artist as string,
        title: t.title as string,
      })),
      await isWhitelisted(userId),
      userId,
    );
    await sql`SELECT save_ai_analysis(${JSON.stringify(rows)}::jsonb)`;
  }
  return batch.length;
}

export interface Progress {
  enrich: { total: number; remaining: number };
  ai: { total: number; remaining: number };
}

export async function getProgress(userId: string): Promise<Progress> {
  const sql = getSql();
  const r = await sql`
    SELECT count(*)::int                       AS enrich_total,
           count(*) FILTER (WHERE a.id IS NULL)::int AS enrich_remaining,
           count(a.id)::int                    AS ai_total,
           count(*) FILTER (WHERE a.id IS NOT NULL AND a.audio_feel IS NULL)::int AS ai_remaining
    FROM user_tracks ut
    LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId}`;
  return {
    enrich: { total: r[0].enrich_total as number, remaining: r[0].enrich_remaining as number },
    ai: { total: r[0].ai_total as number, remaining: r[0].ai_remaining as number },
  };
}

export function phaseOf(p: Progress): Phase {
  if (p.enrich.remaining > 0) return "enrich";
  if (p.ai.remaining > 0) return "ai";
  return "done";
}

/**
 * Per-user worker mutex.
 *
 * cron tick (every 60 s) and the user-driven /api/jobs/tick can both reach
 * runAnalyzeBatch for the same user simultaneously. Without a lock, both
 * paths SELECT the same 8 / 30 unprocessed tracks and BOTH call enrichTrack
 * (Deezer + Last.fm) or aiAnalyzeBatch (Gemini) on every one — duplicate
 * paid API calls, doubled cost, no extra throughput.
 *
 * The lock uses background_jobs.locked_until as the mutex word. The 60 s
 * TTL is the safety net: if a worker dies mid-batch, the lock self-heals
 * on the next call rather than wedging the user's analysis forever.
 *
 * Returns true if this caller now holds the lock and should proceed,
 * false if another worker is in progress (caller should silently no-op).
 */
const LOCK_TTL_SECONDS = 60;

async function tryAcquireAnalyzeLock(userId: string): Promise<boolean> {
  const sql = getSql();
  const r = await sql`
    UPDATE background_jobs
    SET locked_until = now() + (${LOCK_TTL_SECONDS} || ' seconds')::interval
    WHERE user_id = ${userId}
      AND kind = 'analyze'
      AND (locked_until IS NULL OR locked_until < now())
    RETURNING user_id`;
  return r.length > 0;
}

async function releaseAnalyzeLock(userId: string): Promise<void> {
  const sql = getSql();
  // Best-effort release; the TTL also covers us if this fails.
  await sql`
    UPDATE background_jobs SET locked_until = NULL
    WHERE user_id = ${userId} AND kind = 'analyze'`.catch(() => {});
}

/** Runs one batch of the first phase that still has work. Returns 0 when
 *  another worker holds the lock or no work remains — both treated as
 *  "nothing to do this tick" by the callers (cron / /api/jobs). */
export async function runAnalyzeBatch(userId: string): Promise<number> {
  if (!(await tryAcquireAnalyzeLock(userId))) return 0;
  try {
    const phase = phaseOf(await getProgress(userId));
    if (phase === "enrich") return await runEnrichBatch(userId);
    if (phase === "ai") return await runAiAnalysisBatch(userId);
    return 0;
  } finally {
    await releaseAnalyzeLock(userId);
  }
}

export async function isComplete(userId: string): Promise<boolean> {
  const p = await getProgress(userId);
  // Treat 0-track libraries as already complete — without this guard a
  // user whose tracks all got deleted (re-sync edge case, or starting an
  // analyze on an empty library) would stay 'running' forever because
  // `total > 0` could never become true again. phaseOf() returns 'done'
  // when both phase remainings are zero, which covers the 0-track case.
  return phaseOf(p) === "done";
}

export async function getJob(userId: string): Promise<JobStatus> {
  const sql = getSql();
  const rows = await sql`
    SELECT status FROM background_jobs WHERE user_id = ${userId} AND kind = 'analyze'`;
  return rows.length > 0 ? (rows[0].status as JobStatus) : "idle";
}

export async function setJob(userId: string, status: JobStatus): Promise<void> {
  const sql = getSql();
  // Starting a fresh run clears the previous completion notification so the
  // next time it finishes a new email goes out.
  const notified = status === "running" ? null : undefined;
  if (notified === null) {
    await sql`
      INSERT INTO background_jobs (user_id, kind, status, updated_at, notified_at)
      VALUES (${userId}, 'analyze', ${status}, now(), NULL)
      ON CONFLICT (user_id, kind)
      DO UPDATE SET status = ${status}, updated_at = now(), notified_at = NULL`;
  } else {
    await sql`
      INSERT INTO background_jobs (user_id, kind, status, updated_at)
      VALUES (${userId}, 'analyze', ${status}, now())
      ON CONFLICT (user_id, kind) DO UPDATE SET status = ${status}, updated_at = now()`;
  }
}

/**
 * Marks the analyze job done and emails the completion report exactly once.
 * Idempotent — the notified_at guard means repeated calls (cron + foreground)
 * only ever send a single email.
 */
export async function finishJob(userId: string): Promise<void> {
  const sql = getSql();
  // Atomically claim the notification: only the first caller gets a row back.
  const claimed = await sql`
    UPDATE background_jobs
    SET status = 'done', updated_at = now(), notified_at = now()
    WHERE user_id = ${userId} AND kind = 'analyze' AND notified_at IS NULL
    RETURNING user_id`;
  if (claimed.length === 0) {
    // Already notified — just make sure status reflects completion.
    await setJob(userId, "done");
    return;
  }
  try {
    const userRows = await sql`SELECT email FROM users WHERE id = ${userId}`;
    const email = userRows[0]?.email as string | undefined;
    if (!email) return;
    const stats = await getLibraryStats(userId);
    const { subject, html } = buildCompletionEmail(stats);
    const result = await sendEmail({ to: email, subject, html });
    if (result === "failed") {
      // Transient error — release the claim so a later tick retries.
      await sql`
        UPDATE background_jobs SET notified_at = NULL
        WHERE user_id = ${userId} AND kind = 'analyze'`;
    }
    // "skipped" (no API key) keeps the claim so we don't loop forever.
  } catch {
    await sql`
      UPDATE background_jobs SET notified_at = NULL
      WHERE user_id = ${userId} AND kind = 'analyze'`;
  }
}
