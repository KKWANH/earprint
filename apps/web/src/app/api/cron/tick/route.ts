import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { finishJob, isComplete, runAnalyzeBatch } from "@/lib/jobs";
import { runMirBackfillIfDue } from "@/lib/mirBackfill";
import { runRetentionIfDue } from "@/lib/retention";
import { captureError } from "@/lib/sentry";

/**
 * Cron tick — driven by the separate cron worker every minute.
 *
 * Three responsibilities:
 *   1. (optional) Run one analyze batch per running job — gated by
 *      WORKERS_ANALYZE_DISABLED so we can hand the heavy lifting to the
 *      Fly analyzer once we've verified it's stable. The email path
 *      (isComplete → finishJob) stays here regardless because Resend
 *      lives in this codebase.
 *   2. Promote completed jobs to status='done' and fire the completion
 *      email exactly once.
 *   3. Daily retention sweep (kept regardless of who runs analysis).
 *
 * Setting `WORKERS_ANALYZE_DISABLED=true` lets the Fly worker take over
 * batches without redeploying — the cutover is a single Wrangler secret.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  const analyzeDisabled = process.env.WORKERS_ANALYZE_DISABLED === "true";

  const sql = getSql();
  const jobs = await sql`
    SELECT user_id FROM background_jobs
    WHERE kind = 'analyze' AND status = 'running' LIMIT 10`;

  let processed = 0;
  for (const j of jobs) {
    const userId = j.user_id as string;
    if (!analyzeDisabled) {
      try {
        processed += await runAnalyzeBatch(userId);
      } catch (e) {
        // Transient failures retry next tick, but we want them in
        // Sentry so a persistent error (Gemini outage, schema bug)
        // surfaces instead of disappearing into the void.
        captureError(e, { tag: "cron.analyze", extra: { userId } });
      }
    }
    // isComplete + finishJob always run — they're the email path, which
    // we don't want to lose just because Fly is doing the batches.
    if (await isComplete(userId)) await finishJob(userId);
  }

  // Daily housekeeping — both calls return null on minutes when the 24 h
  // window hasn't elapsed yet, so they're cheap (one INSERT…ON CONFLICT
  // each) on the 1,439 ticks per day where nothing's due.
  const [retention, mirBackfill] = await Promise.all([
    runRetentionIfDue().catch(() => null),
    runMirBackfillIfDue().catch(() => null),
  ]);

  return json(
    { ok: true, jobs: jobs.length, processed, retention, mirBackfill, analyzeDisabled },
    200,
  );
}
