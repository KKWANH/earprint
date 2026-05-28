import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * GET /api/spotify/status
 *
 * Cheap read-only endpoint for the SpotifyConnectCard to decide
 * which UI state to render. Returns:
 *   { connected: false }
 * OR
 *   { connected: true, lastSyncedAt: ISO string | null, scope }
 *
 * Does NOT return the token — UI never needs to see it. Auth-gated.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT scope, last_synced_at
      FROM spotify_connections
      WHERE user_id = ${userId}::uuid
      LIMIT 1`;
    if (rows.length === 0) {
      return json({ connected: false, lastSyncedAt: null, scope: null }, 200);
    }
    const r = rows[0]!;
    return json(
      {
        connected: true,
        scope: (r.scope as string) ?? null,
        lastSyncedAt: r.last_synced_at
          ? new Date(r.last_synced_at as string).toISOString()
          : null,
      },
      200,
    );
  } catch {
    // Table not yet migrated — same shape as "not connected" so the
    // UI still renders the Connect button without erroring.
    return json({ connected: false, lastSyncedAt: null, scope: null }, 200);
  }
}
