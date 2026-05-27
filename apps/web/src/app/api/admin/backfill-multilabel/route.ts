import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/constants";
import { aiAnalyzeBatch } from "@/lib/aiAnalyze";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * Admin-only: backfills the new multi-label columns (primary_genre /
 * sub_genres / style_tags / region_tags / era_tags) on existing
 * analysis rows. Re-runs Gemini with the May 2026 prompt for tracks
 * that have a complete analysis_v1 but no primary_genre yet, batch
 * by batch.
 *
 * Why admin-only: Gemini calls cost money. A naive backfill on a
 * 10k-track library is ≈ $0.50 in Gemini bills + counts against the
 * daily Gemini cap. Owner runs it deliberately, in increments.
 *
 * Query params:
 *   ?batch=N    — how many tracks to backfill this call (default 16,
 *                 max 64). Matches the Gemini batch sizing.
 *   ?dry=1      — count what would be backfilled without firing Gemini.
 *
 * Returns: { processed, attempted, capped, error? }.
 */
const MAX_BATCH = 64;

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return json({ error: "admin only" }, 403);
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const requested = Number(url.searchParams.get("batch") ?? 16);
  const batch = Math.min(MAX_BATCH, Math.max(1, Number.isFinite(requested) ? requested : 16));

  const sql = getSql();
  // Candidates: tracks with a v1 analysis row that has audio_feel
  // (= AI phase 2 ran) but no primary_genre yet (= predates the
  // multi-label schema). Prefer recently-liked tracks so the
  // partial backfill noticeably improves the dashboards first.
  const candidates = await sql`
    SELECT t.id, t.artist, t.title
    FROM analysis a
    JOIN tracks t ON t.id = a.track_id
    WHERE a.analysis_version = 1
      AND a.audio_feel IS NOT NULL
      AND a.primary_genre IS NULL
    ORDER BY a.created_at DESC NULLS LAST
    LIMIT ${batch}`;

  if (candidates.length === 0) {
    return json({ ok: true, processed: 0, attempted: 0, done: true }, 200);
  }
  if (dry) {
    return json(
      { ok: true, attempted: candidates.length, processed: 0, dry: true },
      200,
    );
  }

  // Re-run aiAnalyzeBatch with the May 2026 prompt — the new prompt
  // populates the multi-label fields. save_ai_analysis() preserves
  // legacy genres/moods (merge with `||`) so re-running doesn't
  // wipe Last.fm tags.
  let rows;
  try {
    rows = await aiAnalyzeBatch(
      candidates.map((c) => ({
        id: c.id as string,
        artist: c.artist as string,
        title: c.title as string,
      })),
      true, // bypassCap — operator already accepted the cost
      session?.user?.email ?? undefined,
    );
  } catch (e) {
    return json({
      ok: false,
      error: String(e),
      attempted: candidates.length,
      processed: 0,
    }, 502);
  }

  if (rows.length === 0) {
    return json(
      { ok: true, attempted: candidates.length, processed: 0 },
      200,
    );
  }
  await sql`SELECT save_ai_analysis(${JSON.stringify(rows)}::jsonb)`;

  return json(
    { ok: true, attempted: candidates.length, processed: rows.length },
    200,
  );
}
