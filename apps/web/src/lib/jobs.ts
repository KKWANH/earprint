import { getSql } from "./db";
import { enrichTrack } from "./enrich";
import { aiAnalyzeBatch } from "./aiAnalyze";

export type JobStatus = "running" | "stopped" | "done" | "idle";
export type Phase = "enrich" | "ai" | "done";

const BATCH = 8;

/** Phase 1 — Deezer + Last.fm enrichment. Returns tracks processed. */
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

/** Phase 2 — Gemini refines genres/moods and estimates audio feel for every track. */
export async function runAiAnalysisBatch(userId: string): Promise<number> {
  const sql = getSql();
  const batch = await sql`
    SELECT t.id, t.title, t.artist
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    JOIN tracks t ON t.id = a.track_id
    WHERE ut.user_id = ${userId} AND a.analysis_version = 1 AND a.audio_feel IS NULL
    LIMIT ${BATCH}`;
  if (batch.length > 0) {
    const rows = await aiAnalyzeBatch(
      batch.map((t) => ({
        id: t.id as string,
        artist: t.artist as string,
        title: t.title as string,
      })),
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

/** Runs one batch of the first phase that still has work. */
export async function runAnalyzeBatch(userId: string): Promise<number> {
  const phase = phaseOf(await getProgress(userId));
  if (phase === "enrich") return runEnrichBatch(userId);
  if (phase === "ai") return runAiAnalysisBatch(userId);
  return 0;
}

export async function isComplete(userId: string): Promise<boolean> {
  const p = await getProgress(userId);
  return p.enrich.total > 0 && phaseOf(p) === "done";
}

export async function getJob(userId: string): Promise<JobStatus> {
  const sql = getSql();
  const rows = await sql`
    SELECT status FROM background_jobs WHERE user_id = ${userId} AND kind = 'analyze'`;
  return rows.length > 0 ? (rows[0].status as JobStatus) : "idle";
}

export async function setJob(userId: string, status: JobStatus): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO background_jobs (user_id, kind, status, updated_at)
    VALUES (${userId}, 'analyze', ${status}, now())
    ON CONFLICT (user_id, kind) DO UPDATE SET status = ${status}, updated_at = now()`;
}
