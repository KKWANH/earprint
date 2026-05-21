import { getSql } from "./db";
import { enrichTrack } from "./enrich";
import { aiEnrichBatch } from "./aiEnrich";

export type JobKind = "enrich" | "ai_enrich";
export type JobStatus = "running" | "stopped" | "done" | "idle";

const BATCH = 8;

/** Process one enrichment batch (Deezer + Last.fm). Returns tracks processed. */
export async function runEnrichBatch(userId: string): Promise<number> {
  const sql = getSql();
  const batch = await sql`
    SELECT t.id, t.title, t.artist
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId} AND a.id IS NULL
    LIMIT ${BATCH}`;
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

/** Process one AI-enrichment batch (Gemini). Throws if the Gemini call fails. */
export async function runAiEnrichBatch(userId: string): Promise<number> {
  const sql = getSql();
  const batch = await sql`
    SELECT t.id, t.title, t.artist
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    JOIN tracks t ON t.id = a.track_id
    WHERE ut.user_id = ${userId} AND a.analysis_version = 1 AND a.genres IS NULL
    LIMIT ${BATCH}`;
  if (batch.length > 0) {
    const rows = await aiEnrichBatch(
      batch.map((t) => ({
        id: t.id as string,
        artist: t.artist as string,
        title: t.title as string,
      })),
    );
    await sql`SELECT save_ai_enrichments(${JSON.stringify(rows)}::jsonb)`;
  }
  return batch.length;
}

export interface KindProgress {
  total: number;
  remaining: number;
}

/** Progress counts for both job kinds. */
export async function getProgress(
  userId: string,
): Promise<{ enrich: KindProgress; aiEnrich: KindProgress }> {
  const sql = getSql();
  const r = await sql`
    SELECT
      count(*)::int                                                      AS enrich_total,
      count(*) FILTER (WHERE a.id IS NULL)::int                           AS enrich_remaining,
      count(a.id)::int                                                    AS ai_total,
      count(*) FILTER (WHERE a.id IS NOT NULL AND a.genres IS NULL)::int   AS ai_remaining
    FROM user_tracks ut
    LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
    WHERE ut.user_id = ${userId}`;
  return {
    enrich: { total: r[0].enrich_total as number, remaining: r[0].enrich_remaining as number },
    aiEnrich: { total: r[0].ai_total as number, remaining: r[0].ai_remaining as number },
  };
}

export function remainingFor(
  kind: JobKind,
  p: { enrich: KindProgress; aiEnrich: KindProgress },
): number {
  return kind === "enrich" ? p.enrich.remaining : p.aiEnrich.remaining;
}

/** Run one batch for the given kind. */
export function runBatch(kind: JobKind, userId: string): Promise<number> {
  return kind === "enrich" ? runEnrichBatch(userId) : runAiEnrichBatch(userId);
}

export async function getJobs(userId: string): Promise<Record<JobKind, JobStatus>> {
  const sql = getSql();
  const rows = await sql`SELECT kind, status FROM background_jobs WHERE user_id = ${userId}`;
  const out: Record<JobKind, JobStatus> = { enrich: "idle", ai_enrich: "idle" };
  for (const r of rows) out[r.kind as JobKind] = r.status as JobStatus;
  return out;
}

export async function setJob(userId: string, kind: JobKind, status: JobStatus): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO background_jobs (user_id, kind, status, updated_at)
    VALUES (${userId}, ${kind}, ${status}, now())
    ON CONFLICT (user_id, kind) DO UPDATE SET status = ${status}, updated_at = now()`;
}
