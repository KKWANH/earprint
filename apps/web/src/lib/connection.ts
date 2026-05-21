import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { generateSyncToken } from "@/lib/tokens";

export interface Connection {
  userId: string;
  token: string;
}

export interface RecentTrack {
  title: string;
  artist: string;
  capturedAt: string;
}

/**
 * Resolves the signed-in user to a users row, creating it on first use.
 * Reads first so the common (already-registered) path is a single SELECT —
 * this runs on every authenticated request, so it must not write each time.
 */
export async function ensureConnection(): Promise<Connection> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not signed in");

  const sql = getSql();
  const existing = await sql`SELECT id, sync_token FROM users WHERE email = ${email}`;
  if (existing.length > 0) {
    return {
      userId: existing[0].id as string,
      token: existing[0].sync_token as string,
    };
  }

  // First sign-in: create the row. ON CONFLICT covers a concurrent insert race.
  const created = await sql`
    INSERT INTO users (email, display_name, sync_token)
    VALUES (${email}, ${session.user?.name ?? null}, ${generateSyncToken()})
    ON CONFLICT (email) DO UPDATE SET sync_token = users.sync_token
    RETURNING id, sync_token`;
  return {
    userId: created[0].id as string,
    token: created[0].sync_token as string,
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
