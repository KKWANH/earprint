import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { isComplete, runAnalyzeBatch, setJob } from "@/lib/jobs";

/**
 * Cron tick — driven by the separate cron worker every minute.
 * Runs one analyze batch for each running job so analysis keeps progressing
 * after the user closes the tab. One batch per job per tick keeps the request
 * within the Workers subrequest budget.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  const sql = getSql();
  const jobs = await sql`
    SELECT user_id FROM background_jobs
    WHERE kind = 'analyze' AND status = 'running' LIMIT 10`;

  let processed = 0;
  for (const j of jobs) {
    const userId = j.user_id as string;
    try {
      processed += await runAnalyzeBatch(userId);
    } catch {
      /* transient failure — retried next tick */
    }
    if (await isComplete(userId)) await setJob(userId, "done");
  }

  return json({ ok: true, jobs: jobs.length, processed }, 200);
}
