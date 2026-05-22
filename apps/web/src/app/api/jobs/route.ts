import { ensureConnection } from "@/lib/connection";
import { json } from "@/lib/http";
import { GEMINI_CAP_ERROR } from "@/lib/usage";
import {
  finishJob,
  getJob,
  getProgress,
  isComplete,
  phaseOf,
  runAnalyzeBatch,
  setJob,
} from "@/lib/jobs";

/**
 * Runs one analysis batch. Returns true if it stopped on the daily Gemini cap
 * — the job stays "running" so the cron resumes it once the cap resets.
 */
async function batchOrCap(userId: string): Promise<boolean> {
  try {
    await runAnalyzeBatch(userId);
    return false;
  } catch (e) {
    return String(e).includes(GEMINI_CAP_ERROR); // other errors: the cron retries
  }
}

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
    const capped = await batchOrCap(userId); // first batch now for instant feedback
    if (!capped && (await isComplete(userId))) await finishJob(userId);
    return json({ ok: true, capped }, 200);
  }
  // Foreground accelerator — the open panel drives batches; the cron also runs.
  if (body.action === "tick") {
    let capped = false;
    if ((await getJob(userId)) === "running") {
      capped = await batchOrCap(userId);
      if (!capped && (await isComplete(userId))) await finishJob(userId);
    }
    const [status, progress] = await Promise.all([getJob(userId), getProgress(userId)]);
    return json({ ok: true, capped, status, phase: phaseOf(progress), ...progress }, 200);
  }
  return json({ error: "action must be start, stop or tick" }, 400);
}
