import type { NextRequest } from "next/server";
import { z } from "zod";
import { FREE_LIMITS, PAYMENTS_ENABLED } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { isPro } from "@/lib/plan";

/** Hard ceiling for /api/sync request bodies. Empirically ~80 bytes/track
 *  with a comfortable allowance for whitespace and longer names —
 *  4MB covers 50k tracks (~50× the free-tier 500-track cap). */
const MAX_SYNC_BYTES = 4 * 1024 * 1024;

/** Per-token daily request cap. Bumped from the previous 200 because the
 *  extension now fires partial uploads every ~250 captured tracks during a
 *  long scrape (so a 5k library = ~20 partials + 1 final = 21 calls per
 *  re-sync). 500 still gives a ~20× margin over honest use and well below
 *  what a leaked token could use to spam writes. */
const SYNC_PER_DAY = 500;

/** Hard cap on tracks per upload. Real libraries top out around 5k–10k;
 *  anything beyond is either a buggy client or an attack — and the
 *  free-tier `librarySize` slice (handled below) caps the persisted
 *  count further. The 10k ceiling here just bounds the validator's work. */
const MAX_TRACKS_PER_REQUEST = 10_000;

/**
 * Per-track shape coming off the extension. Defensive ceilings so a
 * malformed scrape or a hostile client can't blow up the SQL function
 * with multi-MB title strings or thousand-emoji artist names.
 *
 * `transform(s => s.trim())` on the required fields normalises whitespace
 * before length validation, then `min(1)` rejects all-whitespace rows.
 */
const TrackZ = z.object({
  videoId: z.string().trim().max(64).optional().nullable(),
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().min(1).max(200),
  album: z.string().trim().max(200).optional().nullable(),
  durationMs: z.coerce.number().int().min(0).max(86_400_000).optional().nullable(),
  likedAt: z.string().max(40).optional().nullable(),
  position: z.coerce.number().int().min(0).max(100_000).optional(),
});

const DiagnosticsZ = z
  .object({
    expected: z.number().int().min(0).max(1_000_000).nullable().optional(),
    captured: z.number().int().min(0).max(MAX_TRACKS_PER_REQUEST).optional(),
    endedClean: z.boolean().optional(),
    domPeak: z.number().int().min(0).max(MAX_TRACKS_PER_REQUEST).optional(),
    spinnerSeen: z.boolean().optional(),
    lastTitle: z.string().max(300).nullable().optional(),
  })
  .partial()
  .optional();

const SyncBodyZ = z.object({
  source: z.literal("ytmusic").optional(),
  tracks: z.array(TrackZ).min(1).max(MAX_TRACKS_PER_REQUEST),
  /** When missing, treated as `false` (append-only). See SyncRequest in
   *  packages/shared/src/types.ts for the why. */
  complete: z.boolean().optional(),
  diagnostics: DiagnosticsZ,
});

/**
 * Extension → backend sync of liked songs.
 * Auth: Authorization: Bearer <sync_token> (matched against users.sync_token).
 *
 * The extension service worker's fetch is subject to CORS, so headers are explicit.
 * A Bearer token (not cookies) is used, so Allow-Origin: * is safe.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "missing token" }, 401, CORS);

  const parsed = await readJsonBody<unknown>(req, MAX_SYNC_BYTES, CORS);
  if (!parsed.ok) return parsed.response;

  // Zod validation — rejects oversized strings, malformed track shape,
  // and out-of-range counts before any DB work. Bad clients get a
  // clear 400 instead of an opaque SQL error several layers down.
  const v = SyncBodyZ.safeParse(parsed.data);
  if (!v.success) {
    return json(
      {
        error: "invalid payload",
        issues: v.error.issues.slice(0, 5).map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
      CORS,
    );
  }
  const body = v.data;
  const complete = body.complete === true;

  const sql = getSql();
  const users = await sql`SELECT id FROM users WHERE sync_token = ${token}`;
  if (users.length === 0) return json({ error: "invalid token" }, 401, CORS);
  const userId = users[0].id as string;

  // Per-token daily rate limit. user_usage rows roll over at midnight UTC.
  // Increment-and-read in one statement so concurrent syncs from the same
  // extension don't race past the cap.
  const used = await sql`
    INSERT INTO user_usage (user_id, kind, usage_date, count)
    VALUES (${userId}, 'sync', current_date, 1)
    ON CONFLICT (user_id, kind, usage_date)
    DO UPDATE SET count = user_usage.count + 1
    RETURNING count`;
  const todayCount = (used[0]?.count as number) ?? 0;
  if (todayCount > SYNC_PER_DAY) {
    return json(
      { error: "rate limited", retryAfter: "next UTC day" },
      429,
      CORS,
    );
  }

  // Free-tier library-size gate. Pro / payments-off bypass; otherwise we
  // accept the first N tracks and tell the client how many were dropped so
  // the extension can show an upgrade prompt.
  //
  // Subtle correctness note: when we slice the tracks list, the upload is
  // no longer "complete" by definition — the server now sees a subset of
  // what the extension scraped. Force complete=false in that path so the
  // SQL function won't delete the tracks beyond the cap that we just
  // dropped from this request.
  let tracks = body.tracks;
  let dropped = 0;
  let effectiveComplete = complete;
  if (PAYMENTS_ENABLED && !(await isPro(userId))) {
    const cap = FREE_LIMITS.librarySize;
    if (tracks.length > cap) {
      dropped = tracks.length - cap;
      tracks = tracks.slice(0, cap);
      effectiveComplete = false;
    }
  }

  const rows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${userId},
      ${JSON.stringify(tracks)}::jsonb,
      ${effectiveComplete}
    )`;

  // Persist sync telemetry on the user row so /connect can render a
  // "last sync — complete · 1,417 captured · 0 removed · 12 min ago"
  // status line without re-running the scrape. Best-effort: if this
  // UPDATE fails the sync itself already succeeded.
  const removed = (rows[0]?.removed as number | null) ?? 0;
  const expectedHeader = body.diagnostics?.expected ?? null;
  void sql`
    UPDATE users SET
      last_sync_at        = now(),
      last_sync_complete  = ${effectiveComplete},
      last_sync_captured  = ${tracks.length},
      last_sync_expected  = ${expectedHeader},
      last_sync_removed   = ${removed},
      updated_at          = now()
    WHERE id = ${userId}`.catch(() => {});

  return json(
    {
      ok: true,
      ...rows[0],
      complete: effectiveComplete,
      expected: expectedHeader,
      captured: tracks.length,
      plan_dropped: dropped,
      plan_cap: FREE_LIMITS.librarySize,
    },
    200,
    CORS,
  );
}
