import type { NextRequest } from "next/server";
import { z } from "zod";
import { FREE_LIMITS, PAYMENTS_ENABLED } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { hasEverPurchased, isPro } from "@/lib/plan";
import { hashSyncToken } from "@/lib/tokens";

/**
 * Look up a user by their plaintext bearer token. Hash-first lookup
 * via the indexed sync_token_hash column; falls back to the legacy
 * plaintext column for tokens issued before the hash migration AND
 * back-fills the hash so the next request takes the fast path.
 * Returns the userId or null.
 *
 * Phase 2 (May 2026, in progress): the legacy plaintext fallback is
 * now logged whenever it fires, and the operator-driven admin
 * backfill endpoint (/api/admin/backfill-token-hashes) actively
 * empties the un-hashed pool. Once `remaining` from that endpoint
 * hits zero and stays there for a deploy cycle, drop:
 *   1. the legacy fallback branch below,
 *   2. `users.sync_token` column in the SQL migration,
 *   3. the plaintext-write in `lib/connection.ts` + the rotate
 *      action in `app/account/sync-token-actions.ts`.
 */
async function resolveUserIdByToken(token: string): Promise<string | null> {
  if (!token) return null;
  const sql = getSql();
  const hash = await hashSyncToken(token);
  // Fast path: indexed equality on the hash column. Wrapped in
  // try/catch so an environment where the sync_token_hash column
  // hasn't been migrated yet falls through to the plaintext path
  // below instead of returning 401.
  try {
    const byHash = await sql`
      SELECT id FROM users WHERE sync_token_hash = ${hash} LIMIT 1`;
    if (byHash.length > 0) return byHash[0].id as string;
  } catch {
    /* migration not applied — silently fall through to legacy lookup */
  }
  // Legacy plaintext fallback. Surface this via console so the
  // operator can monitor "is anyone still on plaintext?" via Cloudflare
  // logs and time the drop. On hit, fire-and-forget UPDATE that
  // back-fills the hash — UNIQUE index on sync_token_hash protects
  // against races (concurrent back-fills throw, we swallow).
  const byPlain = await sql`
    SELECT id FROM users WHERE sync_token = ${token} LIMIT 1`;
  if (byPlain.length === 0) return null;
  const userId = byPlain[0].id as string;
  if (typeof console !== "undefined") {
    console.info("[tokens] legacy plaintext fallback hit; backfilling hash", {
      userId,
    });
  }
  void sql`
    UPDATE users
       SET sync_token_hash = ${hash}, updated_at = now()
     WHERE id = ${userId} AND sync_token_hash IS NULL`.catch(() => {
    /* race with another back-fill — already done */
  });
  return userId;
}

/** Hard ceiling for /api/sync request bodies. Empirically ~80 bytes/track
 *  with a comfortable allowance for whitespace and longer names —
 *  4MB covers 50k tracks (~50× the free-tier 500-track cap). */
const MAX_SYNC_BYTES = 4 * 1024 * 1024;

/** Per-token daily request cap. Sized to accommodate the extension's
 *  in-flight partial uploads (every ~250 captured tracks during a long
 *  scrape, so a 5k library = ~20 partials + 1 final = 21 calls per
 *  re-sync). 500 still gives a ~20× margin over honest use and well
 *  below what a leaked token could use to spam writes. */
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
    manualStop: z.boolean().optional(),
  })
  .partial()
  .optional();

const SyncBodyZ = z.object({
  source: z.literal("ytmusic").optional(),
  tracks: z.array(TrackZ).min(1).max(MAX_TRACKS_PER_REQUEST),
  diagnostics: DiagnosticsZ,
});

/**
 * Extension → backend sync of liked songs.
 * Auth: Authorization: Bearer <sync_token> (matched against users.sync_token).
 *
 * APPEND-ONLY: every successful sync inserts new tracks and refreshes
 * list_position on existing ones. Nothing is ever deleted server-side
 * in response to a sync. See sync_liked_tracks in db/schema.sql for
 * the rationale.
 *
 * The extension service worker's fetch is subject to CORS, so headers
 * are explicit. A Bearer token (not cookies) is used, so Allow-Origin: *
 * is safe.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Token-check probe used by the extension popup BEFORE it kicks off a
 * scrape. No sync work, no rate-limit charge — just resolves whether the
 * stored Bearer token still names a real user. Lets the popup surface
 * "your connection expired, re-pair" up-front instead of asking the
 * user to wait 5 minutes for a scroll only to fail at upload with a
 * 401. Same auth shape as POST so the extension can reuse its existing
 * Bearer plumbing.
 */
export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "missing token" }, 401, CORS);
  const userId = await resolveUserIdByToken(token);
  if (!userId) return json({ ok: false, error: "invalid token" }, 401, CORS);
  return json({ ok: true }, 200, CORS);
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

  const sql = getSql();
  const userId = await resolveUserIdByToken(token);
  if (!userId) return json({ error: "invalid token" }, 401, CORS);

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
  // the extension can show an upgrade prompt. The slice is purely a write
  // cap — already-persisted tracks beyond it are not affected because
  // we're append-only.
  let tracks = body.tracks;
  let dropped = 0;
  // Free-tier cap applies only when:
  //   (a) the paywall is live (PAYMENTS_ENABLED),
  //   (b) the user is NOT a Pro subscriber, AND
  //   (c) the user has NEVER bought anything (purchases_count == 0).
  // One paid SKU (₩2,500 single OR ₩5,000 3-pack) lifts the ceiling
  // permanently — the smallest viable purchase counts as "I'm in"
  // and we honour it for the lifetime of the account.
  if (PAYMENTS_ENABLED) {
    const [pro, paid] = await Promise.all([
      isPro(userId),
      hasEverPurchased(userId),
    ]);
    if (!pro && !paid) {
      const cap = FREE_LIMITS.librarySize;
      if (tracks.length > cap) {
        dropped = tracks.length - cap;
        tracks = tracks.slice(0, cap);
      }
    }
  }

  const rows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${userId}::uuid,
      ${JSON.stringify(tracks)}::jsonb
    )`;

  // Persist sync telemetry on the user row so /connect can render a
  // "last sync — 1,417 captured · 12 min ago" status line without
  // re-running the scrape. Best-effort: if this UPDATE fails the sync
  // itself already succeeded.
  const expectedHeader = body.diagnostics?.expected ?? null;
  void sql`
    UPDATE users SET
      last_sync_at       = now(),
      last_sync_captured = ${tracks.length},
      last_sync_expected = ${expectedHeader},
      updated_at         = now()
    WHERE id = ${userId}`.catch(() => {});

  return json(
    {
      ok: true,
      ...rows[0],
      captured: tracks.length,
      expected: expectedHeader,
      plan_dropped: dropped,
      plan_cap: FREE_LIMITS.librarySize,
    },
    200,
    CORS,
  );
}
