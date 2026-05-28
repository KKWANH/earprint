import { auth } from "@/auth";
import { CURRENT_TOS_VERSION } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { generateSyncToken, hashSyncToken } from "@/lib/tokens";

export interface Connection {
  userId: string;
  token: string;
  /** True when the user has accepted the *current* ToS version and
   *  confirmed they are 16+. Pages can use this to gate features. */
  onboarded: boolean;
  /** True when the user has opted into AI profiling. Independent from
   *  onboarding so it can be revoked from /account without disabling
   *  the rest of the service. */
  aiConsent: boolean;
}

export interface RecentTrack {
  title: string;
  artist: string;
  capturedAt: string;
}

/**
 * Resolves the signed-in user to a users row, creating it on first use.
 * Reads first so the common (already-registered) path is a single SELECT.
 * Also touches last_seen_at — the inactivity-retention cron compares
 * against this column, so any authenticated request keeps the row alive.
 */
export async function ensureConnection(): Promise<Connection> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not signed in");

  const sql = getSql();
  const existing = await sql`
    SELECT id, sync_token, tos_accepted_at, tos_version, age_confirmed_at, ai_consent_at
    FROM users WHERE email = ${email}`;

  if (existing.length > 0) {
    const row = existing[0];
    // Best-effort last_seen bump — don't block the request if it fails.
    void sql`UPDATE users SET last_seen_at = now() WHERE id = ${row.id as string}`.catch(
      () => {},
    );
    return {
      userId: row.id as string,
      token: row.sync_token as string,
      onboarded:
        !!row.tos_accepted_at &&
        row.tos_version === CURRENT_TOS_VERSION &&
        !!row.age_confirmed_at,
      aiConsent: !!row.ai_consent_at,
    };
  }

  // First sign-in: create the row, but leave consent fields NULL — the
  // middleware will redirect the user to /onboarding before anything else.
  //
  // Token-storage migration phase 2 (May 2026): we still write the
  // plaintext to `sync_token` for the duration of the legacy-fallback
  // window so existing extension installs that authenticate against
  // /api/sync via plaintext lookup keep working. The PRIMARY storage
  // is now `sync_token_hash` — that's what verification reads first.
  // Plaintext write goes away in the same commit that DROPs the
  // column (operator runs admin/backfill-token-hashes first, confirms
  // remaining == 0, then runs ALTER TABLE DROP COLUMN sync_token).
  const newToken = generateSyncToken();
  const newHash = await hashSyncToken(newToken);
  // Try the hash-column INSERT first; if the migration hasn't run
  // the column doesn't exist and the INSERT throws. Fall back to
  // the legacy INSERT (without the hash column) so first-sign-in
  // works even on a not-yet-migrated DB. The hash gets back-filled
  // by the admin endpoint once the column lands.
  let created;
  try {
    created = await sql`
      INSERT INTO users (email, display_name, sync_token, sync_token_hash)
      VALUES (${email}, ${session.user?.name ?? null}, ${newToken}, ${newHash})
      ON CONFLICT (email) DO UPDATE SET sync_token = users.sync_token
      RETURNING id, sync_token`;
  } catch {
    created = await sql`
      INSERT INTO users (email, display_name, sync_token)
      VALUES (${email}, ${session.user?.name ?? null}, ${newToken})
      ON CONFLICT (email) DO UPDATE SET sync_token = users.sync_token
      RETURNING id, sync_token`;
  }
  return {
    userId: created[0].id as string,
    token: created[0].sync_token as string,
    onboarded: false,
    aiConsent: false,
  };
}

/** Synced-likes count plus the most recent entries. */
export async function getLibrarySummary(
  userId: string,
): Promise<{ count: number; recent: RecentTrack[] }> {
  const sql = getSql();
  const [countRows, recent] = await Promise.all([
    sql`SELECT count(*)::int AS c FROM user_tracks WHERE user_id = ${userId}`,
    sql`
      SELECT t.title, t.artist, ut.captured_at
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId}
      ORDER BY ut.captured_at DESC
      LIMIT 20`,
  ]);
  return {
    count: countRows[0].c as number,
    recent: recent.map((r) => ({
      title: r.title as string,
      artist: r.artist as string,
      capturedAt: r.captured_at as string,
    })),
  };
}

/** Persisted telemetry from the user's most recent /api/sync call. Null
 *  when the user has never synced from a build that populates the
 *  diagnostics. The earlier `complete` and `removed` fields are gone —
 *  sync is append-only now so neither has meaning. */
export interface LastSyncStatus {
  at: string;
  captured: number | null;
  expected: number | null;
}

export async function getLastSyncStatus(
  userId: string,
): Promise<LastSyncStatus | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT last_sync_at, last_sync_captured, last_sync_expected
    FROM users WHERE id = ${userId}`;
  const r = rows[0];
  if (!r?.last_sync_at) return null;
  return {
    at: r.last_sync_at as string,
    captured: (r.last_sync_captured as number | null) ?? null,
    expected: (r.last_sync_expected as number | null) ?? null,
  };
}
