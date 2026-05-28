import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * POST /api/auth/spotify/disconnect
 *
 * Forget the user's Spotify connection. Deletes the spotify_connections
 * row; the user can re-connect by hitting /api/auth/spotify/start
 * again (Spotify's consent page may auto-approve since the scopes
 * are unchanged).
 *
 * NOTE: We do not unsync the user_tracks rows that came from
 * Spotify — those are kept like any other historical sync, append-
 * only (Earprint = permanent listening history). A future
 * "purge Spotify data" affordance would be a separate destructive
 * action requiring explicit confirmation.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();
  const sql = getSql();
  await sql`DELETE FROM spotify_connections WHERE user_id = ${userId}::uuid`;
  return json({ ok: true }, 200);
}
