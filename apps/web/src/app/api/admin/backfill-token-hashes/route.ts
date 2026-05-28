import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { hashSyncToken } from "@/lib/tokens";

/**
 * Admin-only: hashes every user's plaintext sync_token into
 * sync_token_hash. Once this returns `{ remaining: 0 }` the operator
 * can drop the plaintext `sync_token` column from `users` and
 * remove the legacy-fallback branch in `resolveUserIdByToken`.
 *
 * Batches: 500 rows per call (LIMIT below). For ~10k users that's
 * 20 invocations — call this in a loop, ~1 second each, until the
 * `remaining` count goes to zero.
 *
 * Idempotent: a row that already has sync_token_hash is skipped by
 * the WHERE clause. Re-running this after a fresh sign-up flow is
 * a no-op for that row.
 *
 * Cost: every call computes N HMAC-SHA256 + N small UPDATEs. Pure
 * CPU + IO; no external API spend, no Gemini quota touched.
 *
 * Query params:
 *   ?batch=N   — rows to process per call (default 500, max 1000).
 *   ?dry=1     — count rows that WOULD be hashed without changing
 *                anything. Use to verify the migration is needed
 *                before firing the real loop.
 */
const MAX_BATCH = 1000;

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return json({ error: "admin only" }, 403);
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const reqBatch = Number(url.searchParams.get("batch") ?? 500);
  const batch = Math.min(
    MAX_BATCH,
    Math.max(1, Number.isFinite(reqBatch) ? reqBatch : 500),
  );

  const sql = getSql();

  // Count remaining first — gives the operator a progress denominator
  // for free, costs one cheap COUNT(*).
  const [{ remaining }] = (await sql`
    SELECT count(*)::int AS remaining
    FROM users
    WHERE sync_token IS NOT NULL AND sync_token_hash IS NULL`) as Array<{
    remaining: number;
  }>;

  if (dry) {
    return json({ ok: true, remaining, batch, dry: true }, 200);
  }
  if (remaining === 0) {
    return json({ ok: true, remaining: 0, processed: 0, done: true }, 200);
  }

  // Pull a batch of rows that still need hashing. Order by id so a
  // re-run picks up where the previous one left off — not strictly
  // necessary (the WHERE clause excludes already-hashed rows) but
  // makes log inspection saner.
  const rows = (await sql`
    SELECT id, sync_token FROM users
    WHERE sync_token IS NOT NULL AND sync_token_hash IS NULL
    ORDER BY id
    LIMIT ${batch}`) as Array<{ id: string; sync_token: string }>;

  let processed = 0;
  let collisions = 0;
  for (const r of rows) {
    const hash = await hashSyncToken(r.sync_token);
    try {
      const result = await sql`
        UPDATE users
           SET sync_token_hash = ${hash}, updated_at = now()
         WHERE id = ${r.id}::uuid
           AND sync_token_hash IS NULL`;
      // neon-http returns a count via .length on results-as-array, or
      // .rowCount-equivalent on the statement result; here we just
      // count UPDATE calls that didn't throw. The UNIQUE index will
      // throw on a (very unlikely) hash collision, which we count
      // separately so the operator can investigate if it ever spikes.
      void result;
      processed++;
    } catch {
      collisions++;
    }
  }

  // Re-count so the response carries an accurate `remaining`.
  const [{ remaining: remainingAfter }] = (await sql`
    SELECT count(*)::int AS remaining
    FROM users
    WHERE sync_token IS NOT NULL AND sync_token_hash IS NULL`) as Array<{
    remaining: number;
  }>;

  return json(
    {
      ok: true,
      processed,
      collisions,
      remaining: remainingAfter,
      done: remainingAfter === 0,
    },
    200,
  );
}
