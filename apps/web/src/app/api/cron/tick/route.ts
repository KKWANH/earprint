import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { getProgress, remainingFor, runBatch, setJob, type JobKind } from "@/lib/jobs";

/**
 * Cron tick — driven by the separate cron worker every minute.
 * Processes one batch for each running background job, so enrichment keeps
 * progressing after the user closes the tab. One batch per job per tick keeps
 * the request within the Workers subrequest budget.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  const sql = getSql();
  const jobs = await sql`
    SELECT user_id, kind FROM background_jobs WHERE status = 'running' LIMIT 10`;

  let processed = 0;
  for (const j of jobs) {
    const userId = j.user_id as string;
    const kind = j.kind as JobKind;
    try {
      processed += await runBatch(kind, userId);
    } catch {
      /* transient failure — retried next tick */
    }
    if (remainingFor(kind, await getProgress(userId)) === 0) {
      await setJob(userId, kind, "done");
    }
  }

  return json({ ok: true, jobs: jobs.length, processed }, 200);
}
