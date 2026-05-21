import { ensureConnection } from "@/lib/connection";
import { json } from "@/lib/http";
import {
  getJob,
  getProgress,
  isComplete,
  phaseOf,
  runAnalyzeBatch,
  setJob,
} from "@/lib/jobs";

/** Status + progress of the single analyze job (enrich → AI analysis). */
export async function GET() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  const [status, progress] = await Promise.all([getJob(userId), getProgress(userId)]);
  return json({ status, phase: phaseOf(progress), ...progress }, 200);
}

/** Start or stop the analyze job — { action }. */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (body.action === "stop") {
    await setJob(userId, "stopped");
    return json({ ok: true }, 200);
  }
  if (body.action === "start") {
    await setJob(userId, "running");
    try {
      await runAnalyzeBatch(userId); // first batch now for instant feedback
    } catch {
      /* the cron retries */
    }
    if (await isComplete(userId)) await setJob(userId, "done");
    return json({ ok: true }, 200);
  }
  // Foreground accelerator — the open panel drives batches; the cron also runs.
  if (body.action === "tick") {
    if ((await getJob(userId)) === "running") {
      try {
        await runAnalyzeBatch(userId);
      } catch {
        /* the cron retries */
      }
      if (await isComplete(userId)) await setJob(userId, "done");
    }
    const [status, progress] = await Promise.all([getJob(userId), getProgress(userId)]);
    return json({ ok: true, status, phase: phaseOf(progress), ...progress }, 200);
  }
  return json({ error: "action must be start, stop or tick" }, 400);
}
