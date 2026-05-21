import { ensureConnection } from "@/lib/connection";
import { json } from "@/lib/http";
import {
  getJobs,
  getProgress,
  remainingFor,
  runBatch,
  setJob,
  type JobKind,
} from "@/lib/jobs";

const KINDS = new Set<JobKind>(["enrich", "ai_enrich", "audio_feel"]);

/** Current status + progress for both background jobs. */
export async function GET() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  const [jobs, progress] = await Promise.all([getJobs(userId), getProgress(userId)]);
  return json(
    {
      enrich: { status: jobs.enrich, ...progress.enrich },
      aiEnrich: { status: jobs.ai_enrich, ...progress.ai_enrich },
      audioFeel: { status: jobs.audio_feel, ...progress.audio_feel },
    },
    200,
  );
}

/** Start or stop a background job — { kind, action }. */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { kind?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const kind = body.kind as JobKind;
  if (!KINDS.has(kind) || (body.action !== "start" && body.action !== "stop")) {
    return json({ error: "kind and action required" }, 400);
  }

  if (body.action === "stop") {
    await setJob(userId, kind, "stopped");
    return json({ ok: true }, 200);
  }

  // start: mark running, then run one batch now for instant feedback.
  await setJob(userId, kind, "running");
  try {
    await runBatch(kind, userId);
  } catch {
    /* a failed first batch is retried by the cron */
  }
  if (remainingFor(kind, await getProgress(userId)) === 0) {
    await setJob(userId, kind, "done");
  }
  return json({ ok: true }, 200);
}
