import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * Revokes the YouTube OAuth grant and clears stored tokens. Called from
 * /account when the user clicks "Disconnect YouTube". Best-effort revoke:
 * even if Google's revoke endpoint fails, we clear local tokens so the
 * sync path stops working from our side.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return json({ error: "not signed in" }, 401);

  const { userId } = await ensureConnection();
  const sql = getSql();
  const rows = await sql`
    SELECT yt_access_token, yt_refresh_token
    FROM users WHERE id = ${userId}`;
  const u = rows[0] as
    | { yt_access_token: string | null; yt_refresh_token: string | null }
    | undefined;

  // Tell Google to drop the grant. Either the access or refresh token works
  // as input; revoking either invalidates the entire grant for our client.
  const tokenToRevoke = u?.yt_refresh_token ?? u?.yt_access_token;
  if (tokenToRevoke) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
        { method: "POST" },
      );
    } catch {
      // Non-fatal — local clear below is the real disconnect from our side.
    }
  }

  await sql`
    UPDATE users
       SET yt_access_token     = NULL,
           yt_refresh_token    = NULL,
           yt_token_expires_at = NULL,
           updated_at          = now()
     WHERE id = ${userId}`;

  return json({ ok: true }, 200);
}
